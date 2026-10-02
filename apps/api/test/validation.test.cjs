const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  validateTask,
  validateTag,
  validateColumn,
  uuid,
} = require('../dist/validation');
const { parseApiConfig } = require('../dist/config');
const { throwDatabaseError } = require('../dist/database-error');

const columnId = '80bd13f0-6493-4057-8092-af16c8c3c9b2';
const tagId = 'dd5a0928-6b05-4c26-ad85-241121c1f286';
const validTask = { title: 'Essay', status_id: columnId };

test('task input trims text, normalizes UUIDs, and deduplicates tags', () => {
  assert.deepEqual(
    validateTask({
      title: '  Prepare exam  ',
      description: '  # Checklist\n\n- Study  ',
      status_id: ` ${columnId.toUpperCase()} `,
      tag_ids: [tagId, tagId.toUpperCase()],
      duration_hours: 0.25,
      due_date: ' 2028-02-29 ',
    }),
    {
      title: 'Prepare exam',
      description: '  # Checklist\n\n- Study  ',
      status_id: columnId,
      tag_ids: [tagId],
      duration_hours: 0.25,
      due_date: '2028-02-29',
    },
  );
});

test('optional patch values preserve omitted fields and explicit nulls', () => {
  assert.deepEqual(validateTask({ status_id: columnId }, true), {
    status_id: columnId,
  });
  assert.deepEqual(
    validateTask({ due_date: null, duration_hours: null, tag_ids: [] }, true),
    {
      due_date: null,
      duration_hours: null,
      tag_ids: [],
    },
  );
  assert.deepEqual(
    validateTask({ description: '    const markdownCode = true;\n\n' }, true),
    { description: '    const markdownCode = true;\n\n' },
  );
  assert.deepEqual(validateTask({ description: '' }, true), {
    description: '',
  });
  assert.deepEqual(validateTag({ name: ' Homework ' }, true), {
    name: 'Homework',
  });
  assert.deepEqual(validateColumn({ is_done: false }, true), {
    is_done: false,
  });
});

test('task dates reject impossible dates, timestamps, and out-of-range years', () => {
  for (const value of [
    '2027-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '0999-01-01',
    '2026-10-01T00:00:00Z',
    '10/01/2026',
    0,
  ]) {
    assert.throws(() => validateTask({ ...validTask, due_date: value }), {
      status: 400,
    });
  }
  assert.equal(
    validateTask({ ...validTask, due_date: '2026-10-01' }).due_date,
    '2026-10-01',
  );
});

test('task validation rejects malformed UUIDs, blank titles, unsafe durations, and unknown properties', () => {
  for (const title of ['', '   ', null, 'a'.repeat(201)])
    assert.throws(() => validateTask({ ...validTask, title }), { status: 400 });
  for (const value of [0, -1, 1001, NaN, Infinity, '2'])
    assert.throws(() => validateTask({ ...validTask, duration_hours: value }), {
      status: 400,
    });
  assert.throws(() => uuid('not-an-id'), { status: 400 });
  assert.throws(() => validateTask({ ...validTask, tag_ids: ['bad'] }), {
    status: 400,
  });
  assert.throws(
    () => validateTask({ ...validTask, tag_ids: new Array(101).fill(tagId) }),
    { status: 400 },
  );
  assert.throws(
    () => validateTask({ ...validTask, description: 'a'.repeat(20001) }),
    { status: 400 },
  );
  assert.throws(() => validateTask({ ...validTask, user_id: tagId }), {
    status: 400,
  });
  assert.throws(() => validateTask({}, true), { status: 400 });
  assert.throws(() => validateTask([]), { status: 400 });
});

test('settings validation checks hex colors, bounded names, integer positions, and booleans', () => {
  assert.deepEqual(validateTag({ name: ' Class ', color: '#ABCDEF' }), {
    name: 'Class',
    color: '#abcdef',
  });
  for (const input of [
    { name: '', color: '#abcdef' },
    { name: 'a'.repeat(51), color: '#abcdef' },
    { name: 'Class', color: 'red' },
    { name: 'Class', color: '#fff' },
  ]) {
    assert.throws(() => validateTag(input), { status: 400 });
  }
  const valid = { name: 'Review', color: '#abcdef', position: 3 };
  assert.deepEqual(validateColumn(valid), valid);
  for (const input of [
    { ...valid, position: 1.2 },
    { ...valid, position: -1 },
    { ...valid, position: '1' },
    { ...valid, is_done: 'true' },
  ]) {
    assert.throws(() => validateColumn(input), { status: 400 });
  }
});

test('server configuration permits only anon/publishable credentials and exact frontend origins', () => {
  const environment = {
    FRONTEND_URL: 'http://localhost:5173/',
    SUPABASE_URL: 'https://example.supabase.co/',
    SUPABASE_ANON_KEY: 'sb_publishable_test',
  };
  assert.deepEqual(parseApiConfig(environment), {
    port: 3001,
    frontendUrl: 'http://localhost:5173',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'sb_publishable_test',
  });
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
  assert.equal(
    parseApiConfig({ ...environment, SUPABASE_ANON_KEY: jwt }).supabaseAnonKey,
    jwt,
  );
  for (const values of [
    { SUPABASE_ANON_KEY: 'sb_secret_test' },
    {
      SUPABASE_ANON_KEY: `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`,
    },
    { FRONTEND_URL: 'https://example.com/settings' },
    { FRONTEND_URL: '*' },
    { PORT: '0' },
    { PORT: '3.5' },
    { PORT: '70000' },
  ])
    assert.throws(() => parseApiConfig({ ...environment, ...values }));
});

test('database errors expose stable statuses without raw database details', () => {
  for (const code of ['P0002', 'PGRST116'])
    assert.throws(
      () => throwDatabaseError({ code, message: 'secret SQL' }, 'Task'),
      { status: 404 },
    );
  for (const code of ['22023', '23503', '23514'])
    assert.throws(() => throwDatabaseError({ code, message: 'secret SQL' }), {
      status: 400,
    });
  assert.throws(
    () => throwDatabaseError({ code: 'UNKNOWN', message: 'secret SQL' }),
    (error) => error.status === 503 && !error.message.includes('secret'),
  );
});

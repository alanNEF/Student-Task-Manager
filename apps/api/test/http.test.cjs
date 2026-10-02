require('reflect-metadata');
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { UnauthorizedException, NotFoundException } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module');
const { API_CONFIG } = require('../dist/config');
const { configureHttp } = require('../dist/http');
const { SupabaseService } = require('../dist/supabase.service');
const { WorkspaceService } = require('../dist/workspace.service');

const columnId = '80bd13f0-6493-4057-8092-af16c8c3c9b2';
const targetId = 'dd5a0928-6b05-4c26-ad85-241121c1f286';
const taskId = '23dd98f8-d155-4da1-90c3-d81e9ece9534';
const userId = '848ef3a0-6068-421f-9393-56dbcc462883';
const config = {
  port: 3001,
  frontendUrl: 'http://localhost:5173',
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
};
const session = { user: { id: userId }, client: {} };
const calls = [];
let app;
let baseUrl;

before(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_CONFIG)
    .useValue(config)
    .overrideProvider(SupabaseService)
    .useValue({
      authenticate: async (token) => {
        if (token !== 'valid-test-token')
          throw new UnauthorizedException('Please sign in again.');
        return session;
      },
    })
    .overrideProvider(WorkspaceService)
    .useValue({
      workspace: async () => ({
        profile: { id: userId },
        columns: [],
        tags: [],
        tasks: [],
      }),
      createTask: async (...args) => {
        calls.push(['createTask', ...args]);
        return { id: taskId, ...args[1] };
      },
      updateTask: async (...args) => {
        if (args[2].title === 'missing')
          throw new NotFoundException('Task was not found.');
        if (args[2].title === 'explode')
          throw new Error('private SQL credentials');
        calls.push(['updateTask', ...args]);
        return { id: taskId, ...args[2] };
      },
      deleteTask: async (...args) => {
        calls.push(['deleteTask', ...args]);
      },
      createTag: async (...args) => {
        calls.push(['createTag', ...args]);
        return { id: targetId, ...args[1] };
      },
      updateTag: async (...args) => {
        calls.push(['updateTag', ...args]);
        return { id: targetId, ...args[2] };
      },
      deleteTag: async (...args) => {
        calls.push(['deleteTag', ...args]);
      },
      createColumn: async (...args) => {
        calls.push(['createColumn', ...args]);
        return { id: columnId, ...args[1] };
      },
      updateColumn: async (...args) => {
        calls.push(['updateColumn', ...args]);
        return { id: columnId, ...args[2] };
      },
      deleteColumn: async (...args) => {
        calls.push(['deleteColumn', ...args]);
      },
    })
    .compile();
  app = module.createNestApplication({ logger: false });
  configureHttp(app, config);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => {
  if (app) await app.close();
});

async function request(
  path,
  method = 'GET',
  body,
  authenticated = true,
  extraHeaders = {},
) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(authenticated ? { Authorization: 'Bearer valid-test-token' } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  });
}

test('health is public, uses the API prefix, and includes security headers', async () => {
  const response = await request('/health', 'GET', undefined, false);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(`${baseUrl}/health`)).status, 404);
});

test('every data endpoint rejects requests without a verified bearer', async () => {
  const routes = [
    ['GET', '/workspace'],
    ['POST', '/tasks'],
    ['PATCH', `/tasks/${taskId}`],
    ['DELETE', `/tasks/${taskId}`],
    ['POST', '/tags'],
    ['PATCH', `/tags/${targetId}`],
    ['DELETE', `/tags/${targetId}`],
    ['POST', '/columns'],
    ['PATCH', `/columns/${columnId}`],
    ['DELETE', `/columns/${columnId}?moveTo=${targetId}`],
  ];
  const startCalls = calls.length;
  for (const [method, path] of routes) {
    const response = await request(
      path,
      method,
      method === 'GET' || method === 'DELETE' ? undefined : {},
      false,
    );
    assert.equal(response.status, 401, `${method} ${path}`);
  }
  for (const authorization of [
    'Basic token',
    'Bearer',
    'Bearer invalid',
    'Bearer token extra',
  ]) {
    const response = await request('/workspace', 'GET', undefined, false, {
      Authorization: authorization,
    });
    assert.equal(response.status, 401);
  }
  assert.equal(calls.length, startCalls);
});

test('task creation normalizes validated values before calling the data service', async () => {
  const response = await request('/tasks', 'POST', {
    title: '  Study  ',
    status_id: columnId,
    duration_hours: 2,
    due_date: '2026-10-10',
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).title, 'Study');
  assert.deepEqual(calls.at(-1), [
    'createTask',
    session,
    {
      title: 'Study',
      status_id: columnId,
      duration_hours: 2,
      due_date: '2026-10-10',
    },
  ]);
});

test('invalid inputs and malformed JSON return 400 and never call the data service', async () => {
  const count = calls.length;
  for (const body of [
    { title: ' ' },
    { title: 'Study', status_id: 'invalid' },
    { title: 'Study', status_id: columnId, due_date: '2026-02-30' },
    { title: 'Study', status_id: columnId, user_id: userId },
  ]) {
    assert.equal((await request('/tasks', 'POST', body)).status, 400);
  }
  assert.equal(
    (await request(`/tasks/not-a-uuid`, 'PATCH', { title: 'Essay' })).status,
    400,
  );
  const malformed = await request('/tasks', 'POST', '{invalid JSON');
  assert.equal(malformed.status, 400);
  assert.equal(
    (await malformed.json()).message,
    'Request body must contain valid JSON.',
  );
  assert.equal(calls.length, count);
});

test('patches preserve omitted fields and clear explicit nulls and empty tag arrays', async () => {
  const patch = { duration_hours: null, due_date: null, tag_ids: [] };
  const response = await request(`/tasks/${taskId}`, 'PATCH', patch);
  assert.equal(response.status, 200);
  assert.deepEqual(calls.at(-1), ['updateTask', session, taskId, patch]);
  assert.equal(
    (await request(`/tags/${targetId}`, 'PATCH', { name: '  Reading ' }))
      .status,
    200,
  );
  assert.deepEqual(calls.at(-1), [
    'updateTag',
    session,
    targetId,
    { name: 'Reading' },
  ]);
});

test('column deletion requires a distinct destination and returns 204 after the transaction', async () => {
  const count = calls.length;
  assert.equal((await request(`/columns/${columnId}`, 'DELETE')).status, 400);
  assert.equal(
    (await request(`/columns/${columnId}?moveTo=${columnId}`, 'DELETE')).status,
    400,
  );
  assert.equal(calls.length, count);
  const response = await request(
    `/columns/${columnId}?moveTo=${targetId}`,
    'DELETE',
  );
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.deepEqual(calls.at(-1), ['deleteColumn', session, columnId, targetId]);
  assert.equal((await request(`/tasks/${taskId}`, 'DELETE')).status, 204);
});

test('HTTP errors retain meaningful status without leaking unknown internal errors', async () => {
  const missing = await request(`/tasks/${taskId}`, 'PATCH', {
    title: 'missing',
  });
  assert.equal(missing.status, 404);
  const failure = await request(`/tasks/${taskId}`, 'PATCH', {
    title: 'explode',
  });
  assert.equal(failure.status, 500);
  const body = await failure.json();
  assert.equal(body.message, 'An unexpected error occurred. Please try again.');
  assert.equal(JSON.stringify(body).includes('private'), false);
});

test('CORS headers permit only the configured frontend origin', async () => {
  const allowed = await request('/health', 'GET', undefined, false, {
    Origin: config.frontendUrl,
  });
  assert.equal(
    allowed.headers.get('access-control-allow-origin'),
    config.frontendUrl,
  );
  const other = await request('/health', 'GET', undefined, false, {
    Origin: 'https://untrusted.example',
  });
  assert.notEqual(
    other.headers.get('access-control-allow-origin'),
    'https://untrusted.example',
  );
  const preflight = await request('/tasks', 'OPTIONS', undefined, false, {
    Origin: config.frontendUrl,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type',
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get('access-control-allow-origin'),
    config.frontendUrl,
  );
});

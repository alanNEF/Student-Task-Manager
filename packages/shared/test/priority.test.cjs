const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  sortTasks,
  getTaskPriority,
  dueDateEnd,
  recommendedStart,
  completionPercentage,
  isValidDateOnly,
} = require('../dist/index.js');

process.env.TZ = 'America/New_York';

function task(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Assignment',
    description: '',
    status_id: 'todo',
    duration_hours: null,
    due_date: null,
    tag_ids: [],
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...overrides,
  };
}

test('prioritizes long work by its recommended start, even with a later deadline', () => {
  const short = task({
    id: 'short',
    due_date: '2026-10-02',
    duration_hours: 1,
  });
  const long = task({ id: 'long', due_date: '2026-10-03', duration_hours: 40 });
  const undated = task({ id: 'undated', duration_hours: 100 });
  const original = [short, undated, long];
  assert.deepEqual(
    sortTasks(original).map((item) => item.id),
    ['long', 'short', 'undated'],
  );
  assert.deepEqual(
    original.map((item) => item.id),
    ['short', 'undated', 'long'],
  );
});

test('undated tasks remain deterministic and prioritize larger effort', () => {
  const tasks = [
    task({ id: 'a' }),
    task({ id: 'b', duration_hours: 2 }),
    task({ id: 'c', duration_hours: 4 }),
  ];
  assert.deepEqual(
    sortTasks(tasks).map((item) => item.id),
    ['c', 'b', 'a'],
  );
});

test('a date-only deadline remains valid through the end of the local day', () => {
  const deadline = dueDateEnd('2026-10-01');
  assert.equal(new Date(deadline).getHours(), 23);
  assert.equal(new Date(deadline).getDate(), 1);
  assert.equal(
    getTaskPriority(
      task({ due_date: '2026-10-01' }),
      new Date('2026-10-01T22:00:00-04:00').getTime(),
    ),
    'urgent',
  );
  assert.equal(
    getTaskPriority(
      task({ due_date: '2026-10-01' }),
      new Date('2026-10-02T00:00:00-04:00').getTime(),
    ),
    'overdue',
  );
});

test('effort brings upcoming deadlines into the urgent window', () => {
  const now = new Date('2026-10-01T12:00:00-04:00').getTime();
  assert.equal(
    getTaskPriority(task({ due_date: '2026-10-03', duration_hours: 40 }), now),
    'urgent',
  );
  assert.equal(
    getTaskPriority(task({ due_date: '2026-10-03', duration_hours: 1 }), now),
    'upcoming',
  );
  assert.equal(getTaskPriority(task({ due_date: '2026-11-03' }), now), 'none');
  assert.equal(getTaskPriority(task(), now), 'none');
  assert.equal(recommendedStart(task()), Infinity);
});

test('completion follows all customized done columns and handles an empty board', () => {
  const columns = [
    { id: 'todo', is_done: false },
    { id: 'done', is_done: true },
    { id: 'archived', is_done: true },
  ];
  assert.equal(completionPercentage([], columns), 0);
  assert.equal(
    completionPercentage(
      [task(), task({ status_id: 'done' }), task({ status_id: 'archived' })],
      columns,
    ),
    67,
  );
});

test('validates actual calendar dates including leap years and rejects timestamp strings', () => {
  for (const value of ['2024-02-29', '2026-10-01', '2000-02-29'])
    assert.equal(isValidDateOnly(value), true, value);
  for (const value of [
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-10-00',
    '1900-02-29',
    '2026-1-01',
    '2026-10-01T00:00:00Z',
    '',
    '0000-01-01',
  ])
    assert.equal(isValidDateOnly(value), false, value);
});

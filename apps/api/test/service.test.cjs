require('reflect-metadata');
const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const { SupabaseService } = require('../dist/supabase.service');
const { WorkspaceService } = require('../dist/workspace.service');

const userId = '848ef3a0-6068-421f-9393-56dbcc462883';
const taskId = '23dd98f8-d155-4da1-90c3-d81e9ece9534';
const columnId = '80bd13f0-6493-4057-8092-af16c8c3c9b2';

test('Supabase verifies tokens with auth.getUser and forwards each bearer to the RLS client', async () => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({
      path: request.url,
      authorization: request.headers.authorization,
      apikey: request.headers.apikey,
    });
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/auth/v1/user') {
      if (request.headers.authorization !== 'Bearer real-user-token') {
        response
          .writeHead(401)
          .end(JSON.stringify({ msg: 'Invalid JWT', code: 'bad_jwt' }));
        return;
      }
      response.end(
        JSON.stringify({
          id: userId,
          email: 'student@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
        }),
      );
      return;
    }
    response.end('[]');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const service = new SupabaseService({
      supabaseUrl: `http://127.0.0.1:${server.address().port}`,
      supabaseAnonKey: 'sb_publishable_test',
    });
    const session = await service.authenticate('real-user-token');
    assert.equal(session.user.id, userId);
    const { error } = await session.client.from('tasks').select('id');
    assert.equal(error, null);
    assert.equal(requests[0].path, '/auth/v1/user');
    assert.equal(requests[0].authorization, 'Bearer real-user-token');
    assert.equal(requests[1].authorization, 'Bearer real-user-token');
    assert.equal(requests[1].apikey, 'sb_publishable_test');
    await assert.rejects(service.authenticate('unverified-token'), {
      status: 401,
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('task updates use an atomic RPC preserving omitted fields and explicit nulls', async () => {
  const calls = [];
  const task = {
    id: taskId,
    title: 'Essay',
    description: '# Notes',
    status_id: columnId,
    duration_hours: null,
    due_date: null,
    tag_ids: [],
  };
  const session = {
    user: { id: userId },
    client: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: task, error: null };
      },
    },
  };
  const service = new WorkspaceService();
  const patch = { duration_hours: null, due_date: null, tag_ids: [] };
  assert.equal(await service.updateTask(session, taskId, patch), task);
  assert.deepEqual(calls, [
    { name: 'update_task', args: { p_task_id: taskId, p_patch: patch } },
  ]);
  assert.equal('title' in calls[0].args.p_patch, false);
  assert.equal('description' in calls[0].args.p_patch, false);
});

test('task creation supplies optional defaults and column deletion uses the transactional RPC', async () => {
  const calls = [];
  const session = {
    user: { id: userId },
    client: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { id: taskId }, error: null };
      },
    },
  };
  const service = new WorkspaceService();
  await service.createTask(session, { title: 'Essay', status_id: columnId });
  await service.deleteColumn(session, columnId, taskId);
  assert.deepEqual(calls, [
    {
      name: 'create_task',
      args: {
        p_title: 'Essay',
        p_status_id: columnId,
        p_description: '',
        p_duration_hours: null,
        p_due_date: null,
        p_tag_ids: [],
      },
    },
    {
      name: 'delete_board_column',
      args: { p_column_id: columnId, p_move_to: taskId },
    },
  ]);
});

test('missing and inaccessible task updates return 404 without exposing database SQL', async () => {
  const session = {
    user: { id: userId },
    client: {
      rpc: async () => ({
        data: null,
        error: { code: 'P0002', message: 'secret table owner' },
      }),
    },
  };
  await assert.rejects(
    new WorkspaceService().updateTask(session, taskId, { title: 'New title' }),
    (error) => error.status === 404 && !error.message.includes('secret'),
  );
});

test('workspace assembles all task pages beyond the Supabase 1000-row default', async () => {
  const ranges = [];
  const orders = [];
  const profile = {
    id: userId,
    name: 'Student',
    email: 'student@example.com',
    avatar_url: null,
  };
  const tasks = Array.from({ length: 1001 }, (_, index) => ({
    id: `task-${index}`,
    title: `Assignment ${index}`,
    description: '',
    status_id: columnId,
    duration_hours: null,
    due_date: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    task_tags: [{ tag_id: 'tag-one' }],
  }));
  const client = {
    from: (table) => {
      const query = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order(field) {
          orders.push([table, field]);
          return this;
        },
        single: async () => ({ data: profile, error: null }),
        range: async (from, to) => {
          ranges.push([table, from, to]);
          return {
            data: table === 'tasks' ? tasks.slice(from, to + 1) : [],
            error: null,
          };
        },
      };
      return query;
    },
  };
  const workspace = await new WorkspaceService().workspace({
    user: { id: userId },
    client,
  });
  assert.deepEqual(workspace.profile, profile);
  assert.equal(workspace.tasks.length, 1001);
  assert.equal(workspace.tasks.at(-1).id, 'task-1000');
  assert.deepEqual(workspace.tasks.at(-1).tag_ids, ['tag-one']);
  assert.equal('task_tags' in workspace.tasks[0], false);
  assert.deepEqual(
    ranges.filter(([table]) => table === 'tasks'),
    [
      ['tasks', 0, 999],
      ['tasks', 1000, 1999],
    ],
  );
  assert.deepEqual(
    orders.filter(([table]) => table === 'tasks'),
    [
      ['tasks', 'created_at'],
      ['tasks', 'id'],
      ['tasks', 'created_at'],
      ['tasks', 'id'],
    ],
  );
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import type { Task, Workspace } from '@student-task-manager/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspace } from './use-workspace';

const mocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  sendMutation: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  signInWithOAuth: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  isDemo: false,
  configurationError: null,
  getWorkspace: mocks.getWorkspace,
  sendMutation: mocks.sendMutation,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  },
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, warning: vi.fn() },
}));

function session(id: string, token = `token-${id}`): Session {
  return {
    access_token: token,
    refresh_token: `refresh-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-10-01T12:00:00Z',
    },
  };
}

function workspace(id: string): Workspace {
  return {
    profile: { id, name: id, email: `${id}@example.com`, avatar_url: null },
    columns: [
      {
        id: `column-${id}`,
        name: 'To-Do',
        color: '#8b5cf6',
        position: 0,
        is_done: false,
      },
    ],
    tags: [],
    tasks: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

let current!: ReturnType<typeof useWorkspace>;
let emitAuth!: (event: string, value: Session | null) => void;
let root: Root;
let host: HTMLDivElement;

function Probe() {
  current = useWorkspace();
  return <div>{current.workspace?.profile.name ?? 'empty'}</div>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.getSession.mockResolvedValue({
    data: { session: session('student-a') },
    error: null,
  });
  mocks.getWorkspace.mockResolvedValue(workspace('student-a'));
  mocks.onAuthStateChange.mockImplementation((callback) => {
    emitAuth = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function mount() {
  await act(async () => {
    root.render(<Probe />);
  });
}

describe('authenticated workspace boundaries', () => {
  it('discards a board response that arrives after sign-out', async () => {
    const response = deferred<Workspace>();
    mocks.getWorkspace.mockReturnValue(response.promise);
    await mount();
    await act(async () => emitAuth('SIGNED_OUT', null));
    await act(async () => response.resolve(workspace('student-a')));
    expect(current.session).toBeNull();
    expect(current.workspace).toBeNull();
    expect(current.loading).toBe(false);
  });

  it('discards a previous account mutation after switching students', async () => {
    await mount();
    const save = deferred<Task>();
    mocks.sendMutation.mockReturnValue(save.promise);
    let operation!: Promise<boolean>;
    await act(async () => {
      operation = current.mutate({
        kind: 'createTask',
        input: { title: 'Private A work', status_id: 'column-student-a' },
      });
    });
    mocks.getWorkspace.mockResolvedValue(workspace('student-b'));
    await act(async () => emitAuth('SIGNED_IN', session('student-b')));
    await act(async () => {
      save.resolve({
        id: 'a-task',
        title: 'Private A work',
        description: '',
        status_id: 'column-student-a',
        duration_hours: null,
        due_date: null,
        tag_ids: [],
        created_at: '',
        updated_at: '',
      });
      await operation;
    });
    expect(await operation).toBe(false);
    expect(current.workspace?.profile.id).toBe('student-b');
    expect(current.workspace?.tasks).toHaveLength(0);
    expect(current.pending).toBe(false);
  });

  it('accepts a successful save during token rotation and prevents duplicate concurrent saves', async () => {
    await mount();
    const save = deferred<Task>();
    const refreshedBoard = deferred<Workspace>();
    mocks.sendMutation.mockReturnValue(save.promise);
    let operation!: Promise<boolean>;
    const input = { title: 'Research proposal', status_id: 'column-student-a' };
    await act(async () => {
      operation = current.mutate({ kind: 'createTask', input });
    });
    mocks.getWorkspace.mockReturnValue(refreshedBoard.promise);
    await act(async () =>
      emitAuth('TOKEN_REFRESHED', session('student-a', 'rotated-token')),
    );
    expect(current.pending).toBe(true);
    let duplicate!: boolean;
    await act(async () => {
      duplicate = await current.mutate({ kind: 'createTask', input });
    });
    expect(duplicate).toBe(false);
    expect(mocks.sendMutation).toHaveBeenCalledTimes(1);
    await act(async () => {
      save.resolve({
        id: 'canonical-server-task',
        ...input,
        description: '',
        duration_hours: null,
        due_date: null,
        tag_ids: [],
        created_at: '',
        updated_at: '',
      });
      await operation;
    });
    expect(await operation).toBe(true);
    expect(current.pending).toBe(false);
    expect(current.workspace?.tasks.map((task) => task.id)).toEqual([
      'canonical-server-task',
    ]);
    await act(async () => refreshedBoard.resolve(workspace('student-a')));
    expect(current.workspace?.tasks.map((task) => task.id)).toEqual([
      'canonical-server-task',
    ]);
  });

  it('ignores a stale getSession result after a newer sign-in event', async () => {
    const restored = deferred<{ data: { session: Session }; error: null }>();
    mocks.getSession.mockReturnValue(restored.promise);
    await mount();
    mocks.getWorkspace.mockResolvedValue(workspace('student-b'));
    await act(async () => emitAuth('SIGNED_IN', session('student-b')));
    await act(async () =>
      restored.resolve({
        data: { session: session('student-a') },
        error: null,
      }),
    );
    expect(current.session?.user.id).toBe('student-b');
    expect(current.workspace?.profile.id).toBe('student-b');
  });

  it('recovers from session restoration failure without staying in a loading screen', async () => {
    mocks.getSession.mockRejectedValue(new Error('Auth service unavailable'));
    await mount();
    expect(current.authLoading).toBe(false);
    expect(current.error).toBe('Auth service unavailable');
    expect(current.workspace).toBeNull();
  });
});

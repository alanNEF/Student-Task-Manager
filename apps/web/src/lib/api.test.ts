import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('cloud configuration and API boundaries', () => {
  it('uses the labeled local demo only when both cloud values are absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const api = await import('./api');
    expect(api.isDemo).toBe(true);
    expect(api.configurationError).toBeNull();
    expect(api.supabase).toBeNull();
  });
  it('reports partial cloud settings instead of falling back to demo data', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const api = await import('./api');
    expect(api.isDemo).toBe(false);
    expect(api.configurationError).toContain('incomplete');
    expect(api.supabase).toBeNull();
  });
  it('reports an invalid URL without crashing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not a URL');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
    const api = await import('./api');
    expect(api.isDemo).toBe(false);
    expect(api.configurationError).toContain('valid HTTP');
    expect(api.supabase).toBeNull();
  });
  it('sends only authenticated task fields and exposes API failures without replacing them with demo data', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_API_URL', '/api/');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'created' }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: ['Title is required', 'Invalid status'] }),
          { status: 400 },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./api');
    const input = { title: 'Study', status_id: 'column-id' };
    expect(
      await api.sendMutation({ kind: 'createTask', input }, 'session-token'),
    ).toEqual({ id: 'created' });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
        body: JSON.stringify(input),
      }),
    );
    await expect(api.getWorkspace('session-token')).rejects.toThrow(
      'Title is required Invalid status',
    );
  });
  it('handles 204 deletions without parsing a missing JSON body', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_API_URL', '/api');
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./api');
    await expect(
      api.sendMutation(
        { kind: 'deleteColumn', id: 'source', moveTo: 'other' },
        'token',
      ),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      '/api/columns/source?moveTo=other',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

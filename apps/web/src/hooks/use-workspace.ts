import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type {
  BoardColumn,
  Tag,
  Task,
  Workspace,
} from '@student-task-manager/shared';
import { toast } from 'sonner';
import {
  configurationError,
  getWorkspace,
  isDemo,
  sendMutation,
  supabase,
} from '@/lib/api';
import {
  loadDemoWorkspace,
  mutateWorkspace,
  persistDemoWorkspace,
  type Mutation,
} from '@/lib/workspace';

export function useWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(
    !isDemo && !configurationError,
  );
  const [workspace, setWorkspace] = useState<Workspace | null>(() =>
    isDemo ? loadDemoWorkspace() : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const authGeneration = useRef(0);
  const currentIdentity = useRef<string | undefined>(undefined);
  const currentToken = useRef<string | undefined>(undefined);
  const mutationLock = useRef<number | null>(null);
  const loadGeneration = useRef(0);
  const token = session?.access_token;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    const applySession = (current: Session | null) => {
      if (currentIdentity.current !== current?.user.id) {
        authGeneration.current++;
        loadGeneration.current++;
        setPending(false);
        setLoading(false);
        workspaceRef.current = null;
        setWorkspace(null);
        setError(null);
        currentIdentity.current = current?.user.id;
      }
      // Token refresh belongs to the same student. It must not discard an
      // already committed mutation or unlock that student's pending request.
      if (currentToken.current !== current?.access_token) {
        loadGeneration.current++;
        currentToken.current = current?.access_token;
      }
      setSession(current);
      setAuthLoading(false);
    };
    void supabase.auth
      .getSession()
      .then(({ data, error: authError }) => {
        if (active && !receivedAuthEvent) {
          applySession(data.session);
          if (authError) setError(authError.message);
        }
      })
      .catch((failure: unknown) => {
        if (active && !receivedAuthEvent) {
          setAuthLoading(false);
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not restore your session.',
          );
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, current) => {
      if (active) {
        receivedAuthEvent = true;
        applySession(current);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const generation = authGeneration.current;
    const requestGeneration = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const loaded = await getWorkspace(token);
      if (
        generation === authGeneration.current &&
        requestGeneration === loadGeneration.current
      ) {
        workspaceRef.current = loaded;
        setWorkspace(loaded);
      }
    } catch (failure) {
      if (
        generation === authGeneration.current &&
        requestGeneration === loadGeneration.current
      )
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not load your board.',
        );
    } finally {
      if (
        generation === authGeneration.current &&
        requestGeneration === loadGeneration.current
      )
        setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = async (mutation: Mutation): Promise<boolean> => {
    if (!workspaceRef.current) return false;
    const generation = authGeneration.current;
    if (mutationLock.current === generation) return false;
    mutationLock.current = generation;
    setPending(true);
    try {
      if (isDemo) {
        const next = mutateWorkspace(workspaceRef.current, mutation);
        try {
          persistDemoWorkspace(next);
        } catch {
          toast.warning(
            'Browser storage is unavailable. Changes will last only for this visit.',
          );
        }
        workspaceRef.current = next;
        setWorkspace(next);
      } else if (token) {
        const result = await sendMutation(mutation, token);
        if (generation !== authGeneration.current || !workspaceRef.current)
          return false;
        // Use canonical server entities after saving; a failed refresh cannot make a
        // successful creation look unsaved and invite a duplicate retry.
        let updated = mutateWorkspace(workspaceRef.current, mutation);
        if (mutation.kind === 'createTask')
          updated.tasks[updated.tasks.length - 1] = result as Task;
        if (mutation.kind === 'updateTask')
          updated.tasks = updated.tasks.map((task) =>
            task.id === mutation.id ? (result as Task) : task,
          );
        if (mutation.kind === 'createTag')
          updated.tags[updated.tags.length - 1] = result as Tag;
        if (mutation.kind === 'updateTag')
          updated.tags = updated.tags.map((tag) =>
            tag.id === mutation.id ? (result as Tag) : tag,
          );
        if (mutation.kind === 'createColumn')
          updated.columns[updated.columns.length - 1] = result as BoardColumn;
        if (mutation.kind === 'updateColumn')
          updated.columns = updated.columns.map((column) =>
            column.id === mutation.id ? (result as BoardColumn) : column,
          );
        loadGeneration.current++;
        setLoading(false);
        workspaceRef.current = updated;
        setWorkspace(updated);
      } else throw new Error('Please sign in to save your changes.');
      return true;
    } catch (failure) {
      if (generation === authGeneration.current)
        toast.error(
          failure instanceof Error
            ? failure.message
            : 'Your change could not be saved.',
        );
      return false;
    } finally {
      if (mutationLock.current === generation) mutationLock.current = null;
      if (generation === authGeneration.current) setPending(false);
    }
  };

  const signIn = async () => {
    if (!supabase) return;
    setPending(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (signInError) throw signInError;
    } catch (failure) {
      toast.error(
        failure instanceof Error
          ? failure.message
          : 'Could not sign in. Please try again.',
      );
      setPending(false);
    }
  };
  const signOut = async () => {
    if (!supabase) return;
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      authGeneration.current++;
      loadGeneration.current++;
      workspaceRef.current = null;
      setWorkspace(null);
      setError(null);
    } catch (failure) {
      toast.error(
        failure instanceof Error
          ? failure.message
          : 'Could not sign out. Please try again.',
      );
    }
  };

  return {
    workspace,
    session,
    authLoading,
    loading,
    error,
    pending,
    mutate,
    refresh,
    signIn,
    signOut,
    isDemo,
  };
}

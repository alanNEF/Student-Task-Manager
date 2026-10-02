import { createClient } from '@supabase/supabase-js';
import type { Workspace } from '@student-task-manager/shared';
import type { Mutation } from './workspace';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const isDemo = !supabaseUrl && !supabaseKey;
export const configurationError = (() => {
  if (isDemo) return null;
  if (!supabaseUrl || !supabaseKey)
    return 'Cloud configuration is incomplete. Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or remove both to use the local demo.';
  try {
    const url = new URL(supabaseUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
  } catch {
    return 'VITE_SUPABASE_URL must be a valid HTTP or HTTPS URL. Update the web environment and restart the app.';
  }
  return null;
})();
export const supabase =
  isDemo || configurationError
    ? null
    : createClient(supabaseUrl!, supabaseKey!);
const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request<T>(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(
      'The server could not be reached. Check your connection and try again.',
    );
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(' ')
      : payload?.message;
    throw new Error(
      message ||
        (response.status === 401
          ? 'Your session has expired. Sign in again.'
          : `The request failed (${response.status}). Please try again.`),
    );
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function getWorkspace(token: string) {
  return request<Workspace>('/workspace', token);
}
export async function sendMutation(
  mutation: Mutation,
  token: string,
): Promise<unknown> {
  switch (mutation.kind) {
    case 'createTask':
      return request('/tasks', token, 'POST', mutation.input);
    case 'updateTask':
      return request(`/tasks/${mutation.id}`, token, 'PATCH', mutation.input);
    case 'deleteTask':
      return request(`/tasks/${mutation.id}`, token, 'DELETE');
    case 'createTag':
      return request('/tags', token, 'POST', mutation.input);
    case 'updateTag':
      return request(`/tags/${mutation.id}`, token, 'PATCH', mutation.input);
    case 'deleteTag':
      return request(`/tags/${mutation.id}`, token, 'DELETE');
    case 'createColumn':
      return request('/columns', token, 'POST', mutation.input);
    case 'updateColumn':
      return request(`/columns/${mutation.id}`, token, 'PATCH', mutation.input);
    case 'deleteColumn':
      return request(
        `/columns/${mutation.id}?moveTo=${encodeURIComponent(mutation.moveTo)}`,
        token,
        'DELETE',
      );
  }
}

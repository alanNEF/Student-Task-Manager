import { config as loadDotEnv } from 'dotenv';
import { resolve } from 'node:path';

export const API_CONFIG = Symbol('API_CONFIG');

export interface ApiConfig {
  port: number;
  frontendUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function absoluteUrl(
  value: string | undefined,
  name: string,
  originOnly: boolean,
): string {
  if (!value) throw new Error(`${name} must be configured.`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP or HTTPS URL.`);
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${name} must be an absolute HTTP or HTTPS URL without credentials, query, or fragment.`,
    );
  }
  if (originOnly && parsed.pathname !== '/')
    throw new Error(`${name} must contain only the frontend origin.`);
  return originOnly ? parsed.origin : parsed.href.replace(/\/$/, '');
}

export function parseApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const rawPort = environment.PORT ?? '3001';
  const port = Number(rawPort);
  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const key = environment.SUPABASE_ANON_KEY?.trim();
  if (!key)
    throw new Error(
      'SUPABASE_ANON_KEY must be configured with the anon or publishable key.',
    );
  // RLS must remain active. Reject elevated keys before any database requests.
  if (key.startsWith('sb_secret_'))
    throw new Error('SUPABASE_ANON_KEY cannot be a secret key.');
  if (!key.startsWith('sb_publishable_')) {
    let role: unknown;
    try {
      role = JSON.parse(
        Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8'),
      ).role;
    } catch {
      throw new Error(
        'SUPABASE_ANON_KEY must be an anon JWT or a publishable key.',
      );
    }
    if (role !== 'anon')
      throw new Error('SUPABASE_ANON_KEY must have the anon role.');
  }
  return {
    port,
    frontendUrl: absoluteUrl(environment.FRONTEND_URL, 'FRONTEND_URL', true),
    supabaseUrl: absoluteUrl(environment.SUPABASE_URL, 'SUPABASE_URL', true),
    supabaseAnonKey: key,
  };
}

export function loadApiConfig(): ApiConfig {
  loadDotEnv({ path: resolve(__dirname, '../.env'), quiet: true });
  return parseApiConfig(process.env);
}

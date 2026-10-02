import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { API_CONFIG, type ApiConfig } from './config';

export interface AuthSession {
  user: User;
  client: SupabaseClient;
}

@Injectable()
export class SupabaseService {
  private readonly authClient: SupabaseClient;

  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {
    this.authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async authenticate(token: string): Promise<AuthSession> {
    const { data, error } = await this.authClient.auth.getUser(token);
    if (error || !data.user)
      throw new UnauthorizedException(
        'Your session has expired. Please sign in again.',
      );
    // A new client per request avoids sharing one student's access token with another.
    const client = createClient(
      this.config.supabaseUrl,
      this.config.supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );
    return { user: data.user, client };
  }
}

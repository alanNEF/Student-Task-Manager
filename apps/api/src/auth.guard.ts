import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService, type AuthSession } from './supabase.service';

export interface AuthenticatedRequest extends Request {
  session: AuthSession;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/i.exec(authorization)
        : null;
    if (!match)
      throw new UnauthorizedException('Sign in to access your workspace.');
    request.session = await this.supabase.authenticate(match[1]);
    return true;
  }
}

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthSession => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().session;
  },
);

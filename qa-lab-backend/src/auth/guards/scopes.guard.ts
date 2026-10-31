import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from '../decorators/require-scopes.decorator';
import type { AuthenticatedUser } from '../types/principal';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    // JWT user sessions: full access within membership checks
    if (user.kind !== 'api_key') return true;

    const scopes = user.scopes || [];
    if (scopes.includes('*')) return true;

    const missing = required.filter((s) => !scopes.includes(s));
    if (missing.length) {
      throw new ForbiddenException(
        `API key missing required scope(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}

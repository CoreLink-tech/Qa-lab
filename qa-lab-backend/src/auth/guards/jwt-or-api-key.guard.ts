import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import type { JwtPayload } from '../strategies/jwt.strategy';
import { toAuthenticatedUser, type RequestPrincipal } from '../types/principal';

/**
 * Accepts either:
 * - Authorization: Bearer <jwt>
 * - Authorization: Bearer qalab_...
 * - X-API-Key: qalab_...
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: unknown;
    }>();

    const header = request.headers['authorization'];
    const auth =
      typeof header === 'string'
        ? header
        : Array.isArray(header)
          ? header[0]
          : undefined;
    const xApiKeyRaw = request.headers['x-api-key'];
    const xApiKey =
      typeof xApiKeyRaw === 'string'
        ? xApiKeyRaw
        : Array.isArray(xApiKeyRaw)
          ? xApiKeyRaw[0]
          : undefined;

    let bearer: string | undefined;
    if (auth?.toLowerCase().startsWith('bearer ')) {
      bearer = auth.slice(7).trim();
    }

    const apiKeyCandidate =
      (bearer && bearer.startsWith('qalab_') ? bearer : undefined) ||
      (xApiKey?.startsWith('qalab_') ? xApiKey : undefined);

    if (apiKeyCandidate) {
      const key = await this.apiKeys.validateRawKey(apiKeyCandidate);
      if (!key) {
        throw new UnauthorizedException('Invalid or revoked API key');
      }
      const principal: RequestPrincipal = {
        kind: 'api_key',
        userId: key.createdById,
        apiKeyId: key.id,
        organizationId: key.organizationId,
        scopes: Array.isArray(key.scopes) ? key.scopes : [],
      };
      request.user = toAuthenticatedUser(principal);
      return true;
    }

    if (bearer) {
      try {
        const secret = this.config.get<string>('jwt.accessSecret');
        if (!secret) throw new Error('missing jwt secret');
        const payload = await this.jwt.verifyAsync<JwtPayload>(bearer, {
          secret,
        });
        const principal: RequestPrincipal = {
          kind: 'user',
          userId: payload.sub,
          email: payload.email,
          scopes: ['*'],
        };
        request.user = toAuthenticatedUser(principal);
        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired access token');
      }
    }

    throw new UnauthorizedException('Missing authentication');
  }
}

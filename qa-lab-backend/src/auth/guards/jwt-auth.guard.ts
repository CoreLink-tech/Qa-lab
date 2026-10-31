import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes that require a valid access JWT.
 * Pair with `@CurrentUser()` to read the authenticated principal.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

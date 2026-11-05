import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * Origin / Referer CSRF check for cookie-authenticated mutations.
 * Safe methods (GET/HEAD/OPTIONS) are skipped.
 * Requests with Authorization Bearer (API keys / pure JWT clients) are skipped
 * when no session cookie is present — browser form posts rely on cookies.
 */
@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    const hasRefreshCookie = Boolean(
      req.cookies && (req.cookies as Record<string, string>)['qalab_refresh'],
    );
    if (!hasRefreshCookie) {
      // No cookie session → not a classic browser CSRF vector for our model
      return next();
    }

    const allowed = this.allowedOrigins();
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (origin && allowed.has(this.normalizeOrigin(origin))) {
      return next();
    }
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (allowed.has(this.normalizeOrigin(refOrigin))) {
          return next();
        }
      } catch {
        /* ignore */
      }
    }

    throw new BadRequestException('CSRF origin check failed');
  }

  private allowedOrigins(): Set<string> {
    const set = new Set<string>();
    const cors =
      this.config.get<string>('CORS_ORIGIN') ||
      process.env.CORS_ORIGIN ||
      'http://localhost:3001';
    for (const part of cors.split(',')) {
      const t = part.trim();
      if (t) set.add(this.normalizeOrigin(t));
    }
    // API self
    const port = process.env.PORT || '3000';
    set.add(`http://localhost:${port}`);
    set.add(`http://127.0.0.1:${port}`);
    return set;
  }

  private normalizeOrigin(o: string): string {
    try {
      return new URL(o).origin;
    } catch {
      // Strip trailing slashes without regex (CodeQL polynomial-regex rule).
      let end = o.length;
      while (end > 0 && o.charCodeAt(end - 1) === 47 /* / */) end -= 1;
      return o.slice(0, end);
    }
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { metrics } from './metrics';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { requestId?: string }>();
    const res = http.getResponse<Response>();
    const start = Date.now();
    const path = req.route?.path || req.path;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          metrics.httpRequests.inc(req.method, res.statusCode || 200);
          metrics.httpDuration.observe(ms);

          console.log(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: 'info',
              type: 'http',
              requestId: req.requestId,
              method: req.method,
              path,
              status: res.statusCode,
              durationMs: ms,
            }),
          );
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          metrics.httpRequests.inc(req.method, 500);

          console.log(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: 'error',
              type: 'http',
              requestId: req.requestId,
              method: req.method,
              path,
              durationMs: ms,
              error: err.message,
            }),
          );
        },
      }),
    );
  }
}

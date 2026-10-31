import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const id =
      incoming && incoming.length <= 128 ? incoming : randomUUID();
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}

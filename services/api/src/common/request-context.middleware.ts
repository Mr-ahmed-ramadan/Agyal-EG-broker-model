import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { newRequestContext, runWithContext } from './request-context';

/** Starts the per-request audit context (request id, IP, user agent). */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const ctx = newRequestContext(req.ip ?? null, req.headers['user-agent'] ?? null);
    res.setHeader('X-Request-Id', ctx.requestId);
    runWithContext(ctx, next);
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AppRequest } from './auth';
import { DbService } from './db.service';

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? 'agyal.app';

/**
 * Resolves the broker (tenant) for a request (ADR 0002): the `X-Tenant`
 * header (slug; used by local dev and the SPA dev servers), a custom domain,
 * or a `<slug>.<platform domain>` subdomain.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly db: DbService) {}

  async use(req: AppRequest, _res: Response, next: NextFunction) {
    const header = req.headers['x-tenant'];
    const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '').toString().split(':')[0];
    try {
      if (typeof header === 'string' && header) {
        req.tenant = (await this.db.tenant.findUnique({ where: { slug: header } })) ?? undefined;
      } else if (host) {
        req.tenant =
          (await this.db.tenant.findUnique({ where: { customDomain: host } })) ??
          (host.endsWith(`.${PLATFORM_DOMAIN}`)
            ? (await this.db.tenant.findUnique({
                where: { slug: host.slice(0, -PLATFORM_DOMAIN.length - 1) },
              })) ?? undefined
            : undefined);
      }
      if (req.tenant && req.tenant.status !== 'ACTIVE') req.tenant = undefined;
      next();
    } catch (err) {
      next(err);
    }
  }
}

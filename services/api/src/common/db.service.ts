import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

/**
 * Database access with Row-Level Security (ADR 0002).
 *
 * Tenant-owned tables must be accessed through `forTenant()`, which runs the work
 * in a transaction with `app.tenant_id` set, so PostgreSQL only returns and
 * accepts that tenant's rows. `asSystem()` bypasses RLS and is reserved for
 * platform jobs (e.g. routing inbound FIX messages to their tenant) and
 * platform-admin endpoints.
 */
@Injectable()
export class DbService extends PrismaClient implements OnModuleDestroy {
  async forTenant<T>(tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return work(tx);
    });
  }

  async asSystem<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return work(tx);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

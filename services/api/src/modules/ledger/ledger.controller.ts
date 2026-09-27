import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { DbService } from '../../common/db.service';
import { parseBody } from '../../common/validation';
import { depositEntry } from '../../domain/ledger-rules';
import { LedgerService } from './ledger.service';

const DepositSchema = z.object({
  depositReference: z.string().min(4),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount with up to 2 decimals'),
  bankReference: z.string().min(3),
});

@Controller()
export class LedgerController {
  constructor(
    private readonly db: DbService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** Client: cash and positions from the broker's ledger. */
  @Get('portfolio')
  @Auth('CLIENT')
  portfolio(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.db.forTenant(t.id, (tx) => this.ledger.clientPortfolio(tx, t.id, u.clientId!));
  }

  /**
   * Broker ops: confirm a transfer received on the segregated client-money
   * account, matched by the client's deposit reference (ADR 0007).
   */
  @Post('broker/deposits')
  @Auth('BROKER_OPS', 'BROKER_FINANCE', 'BROKER_ADMIN')
  deposit(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    const input = parseBody(DepositSchema, body);
    return this.db.forTenant(t.id, async (tx) => {
      const client = await tx.client.findFirst({ where: { depositReference: input.depositReference } });
      if (!client) throw new NotFoundException('No client with this deposit reference');
      const entry = await this.ledger.post(
        tx,
        t.id,
        'DEPOSIT',
        input.bankReference,
        depositEntry(client.id, input.amount),
        u.sub,
      );
      await this.audit.record(tx, {
        tenantId: t.id,
        actorId: u.sub,
        action: 'DEPOSIT_CONFIRMED',
        entity: 'Client',
        entityId: client.id,
        data: input,
      });
      return { journalEntryId: entry.id, clientId: client.id };
    });
  }

  @Get('broker/ledger/trial-balance')
  @Auth('BROKER_FINANCE', 'BROKER_OPS', 'BROKER_ADMIN')
  trialBalance(@CurrentTenant() t: Tenant) {
    return this.db.forTenant(t.id, (tx) => this.ledger.trialBalance(tx));
  }
}

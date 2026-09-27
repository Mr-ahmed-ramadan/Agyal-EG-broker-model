import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { DbService } from '../../common/db.service';
import { parseBody } from '../../common/validation';
import { InvestorCodeService } from './investor-code.service';

const CompleteSchema = z.object({
  code: z.string(),
  custodyAccounts: z
    .array(
      z.object({
        depository: z.enum(['MCDR', 'CBE', 'BANK_INTERNAL']),
        custodian: z.string().min(2),
        accountNumber: z.string().min(2),
      }),
    )
    .min(1),
});

@Controller('broker/investor-codes')
@Auth('BROKER_OPS', 'BROKER_ADMIN')
export class InvestorCodeController {
  constructor(
    private readonly db: DbService,
    private readonly codes: InvestorCodeService,
  ) {}

  @Get('tasks')
  tasks(@CurrentTenant() tenant: Tenant) {
    return this.db.forTenant(tenant.id, (tx) => this.codes.pendingTasks(tx));
  }

  @Post(':clientId')
  complete(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(CompleteSchema, body);
    return this.db
      .forTenant(tenant.id, (tx) => this.codes.complete(tx, tenant.id, user.sub, clientId, input))
      .then(() => ({ ok: true }));
  }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { IncomeService } from './income.service';

const ConfirmSchema = z.object({
  isin: z.string().min(12).max(12),
  type: z.enum(['COUPON', 'REDEMPTION']),
  paymentDate: z.string().date(),
  reference: z.string().min(3),
});

@Controller()
export class IncomeController {
  constructor(private readonly income: IncomeService) {}

  @Get('income')
  @Auth('CLIENT')
  mine(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.income.forClient(t, u.clientId!);
  }

  @Get('broker/income')
  @Auth('BROKER_OPS', 'BROKER_FINANCE', 'BROKER_ADMIN')
  pending(@CurrentTenant() t: Tenant) {
    return this.income.pending(t);
  }

  @Get('broker/income/history')
  @Auth('BROKER_OPS', 'BROKER_FINANCE', 'BROKER_ADMIN')
  history(@CurrentTenant() t: Tenant) {
    return this.income.history(t);
  }

  @Post('broker/income/confirm')
  @Auth('BROKER_OPS', 'BROKER_ADMIN')
  confirm(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.income.confirm(t, u.sub, parseBody(ConfirmSchema, body));
  }
}

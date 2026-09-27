import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { CashService } from './cash.service';

const amount = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount with up to 2 decimals');
const BankAccountSchema = z.object({ iban: z.string().min(15), bankName: z.string().min(2), holderName: z.string().min(3) });
const WithdrawalSchema = z.object({ amount, bankAccountId: z.string().uuid() });
const ConfirmSchema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });
const RejectSchema = z.object({ reason: z.string().min(3) });
const PaidSchema = z.object({ bankReference: z.string().min(3) });
const SettleSchema = z.object({ reference: z.string().min(3) });
const SweepSchema = z.object({
  amount,
  bankReference: z.string().min(3),
  /** Which payable is paid out; default the broker's own revenue */
  account: z.enum(['BROKER_REVENUE', 'PLATFORM_FEE', 'CUSTODY_FEE']).optional(),
});

/** Client cash: summary, bank account and withdrawals. Changes need an SMS step-up code. */
@Controller()
export class ClientCashController {
  constructor(private readonly cash: CashService) {}

  @Get('cash')
  @Auth('CLIENT')
  summary(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.cash.summary(t, u.clientId!);
  }

  @Get('bank-accounts')
  @Auth('CLIENT')
  bankAccounts(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.cash.bankAccounts(t, u.clientId!);
  }

  /** Returns a STEP_UP challenge; the account is added on /step-up/confirm. */
  @Post('bank-accounts')
  @Auth('CLIENT')
  addBankAccount(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.cash.startAddBankAccount(t, u, parseBody(BankAccountSchema, body));
  }

  @Get('withdrawals')
  @Auth('CLIENT')
  myWithdrawals(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.cash.listWithdrawals(t, u.clientId!);
  }

  /** Returns a STEP_UP challenge; the withdrawal is created on /step-up/confirm. */
  @Post('withdrawals')
  @Auth('CLIENT')
  requestWithdrawal(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.cash.startWithdrawal(t, u, parseBody(WithdrawalSchema, body));
  }

  @Post('step-up/confirm')
  @Auth('CLIENT')
  confirm(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    const { challengeId, code } = parseBody(ConfirmSchema, body);
    return this.cash.confirmStepUp(t, u, challengeId, code);
  }
}

/** Broker back office: settlements, withdrawal approval/payout, revenue sweep. */
@Controller('broker')
export class BrokerCashController {
  constructor(private readonly cash: CashService) {}

  @Get('settlements')
  @Auth('BROKER_OPS', 'BROKER_ADMIN')
  settlements(@CurrentTenant() t: Tenant) {
    return this.cash.pendingSettlements(t);
  }

  @Post('settlements/:orderId')
  @Auth('BROKER_OPS', 'BROKER_ADMIN')
  settle(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Param('orderId') orderId: string, @Body() body: unknown) {
    return this.cash.confirmSettlement(t, u.sub, orderId, parseBody(SettleSchema, body).reference);
  }

  @Get('withdrawals')
  @Auth('BROKER_FINANCE', 'BROKER_OPS', 'BROKER_ADMIN')
  withdrawals(@CurrentTenant() t: Tenant) {
    return this.cash.listWithdrawals(t);
  }

  @Post('withdrawals/:id/approve')
  @Auth('BROKER_FINANCE', 'BROKER_ADMIN')
  approve(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.cash.approveWithdrawal(t, u.sub, id);
  }

  @Post('withdrawals/:id/reject')
  @Auth('BROKER_FINANCE', 'BROKER_ADMIN')
  reject(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.cash.rejectWithdrawal(t, u.sub, id, parseBody(RejectSchema, body).reason);
  }

  @Post('withdrawals/:id/paid')
  @Auth('BROKER_OPS', 'BROKER_FINANCE', 'BROKER_ADMIN')
  paid(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.cash.markWithdrawalPaid(t, u.sub, id, parseBody(PaidSchema, body).bankReference);
  }

  @Get('revenue')
  @Auth('BROKER_FINANCE', 'BROKER_ADMIN')
  revenue(@CurrentTenant() t: Tenant) {
    return this.cash.revenue(t);
  }

  @Post('revenue/sweep')
  @Auth('BROKER_FINANCE', 'BROKER_ADMIN')
  sweep(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.cash.sweepRevenue(t, u.sub, parseBody(SweepSchema, body));
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Prisma, Tenant } from '@prisma/client';
import { ExecType, OrdStatus, Side } from '@agyal/shared-types';
import { AuditService } from '../../common/audit.service';
import type { AuthUser } from '../../common/auth';
import { DbService, type Tx } from '../../common/db.service';
import { holderMatchesClient, isValidEgyptianIban, maskIban, normaliseIban } from '../../domain/iban';
import {
  buySettlementEntry,
  LedgerAccountType,
  revenueSweepEntry,
  sellSettlementEntry,
  withdrawableCash,
  withdrawalHoldEntry,
  withdrawalPaidEntry,
  withdrawalReleaseEntry,
} from '../../domain/ledger-rules';
import { IdentityService } from '../identity/identity.service';
import { OtpService } from '../identity/otp.service';
import { LedgerService } from '../ledger/ledger.service';

/** Actions a client authorises with an SMS step-up code (ADR 0010). */
type StepUpAction =
  | { action: 'ADD_BANK_ACCOUNT'; tenantId: string; iban: string; bankName: string; holderName: string }
  | { action: 'REQUEST_WITHDRAWAL'; tenantId: string; amount: string; bankAccountId: string };

/** Orders in these states can settle once they have fills. */
const SETTLEABLE = [OrdStatus.Filled, OrdStatus.Canceled, OrdStatus.Expired] as string[];

/**
 * Closing the cash loop (ADR 0007): settlement with banks, client
 * withdrawals with maker-checker payout, and sweeping broker revenue out of
 * the segregated client-money account.
 */
@Injectable()
export class CashService {
  constructor(
    private readonly db: DbService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
    private readonly identity: IdentityService,
  ) {}

  // --- Client: cash summary ------------------------------------------------------------

  async summary(tenant: Tenant, clientId: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const bal = (type: LedgerAccountType) => this.ledger.balance(tx, tenant.id, { type, unit: 'EGP', clientId });
      const available = await bal(LedgerAccountType.CLIENT_CASH_AVAILABLE);
      const unsettled = await this.unsettledSaleProceeds(tx, clientId);
      return {
        currency: 'EGP',
        available: available.toFixed(2),
        reserved: (await bal(LedgerAccountType.CLIENT_CASH_RESERVED)).toFixed(2),
        pendingWithdrawal: (await bal(LedgerAccountType.CLIENT_CASH_PENDING_WITHDRAWAL)).toFixed(2),
        unsettledSaleProceeds: unsettled.toFixed(2),
        withdrawable: withdrawableCash(available, unsettled).toFixed(2),
      };
    });
  }

  /** Net proceeds of sell fills whose bank payment has not settled yet. */
  private async unsettledSaleProceeds(tx: Tx, clientId: string): Promise<Decimal> {
    const agg = await tx.execution.aggregate({
      where: { execType: ExecType.Trade, order: { clientId, side: Side.Sell, settledAt: null } },
      _sum: { clientAmount: true },
    });
    return new Decimal(agg._sum.clientAmount?.toString() ?? 0);
  }

  // --- Client: bank account and withdrawals (step-up) --------------------------------

  async bankAccounts(tenant: Tenant, clientId: string) {
    const accounts = await this.db.forTenant(tenant.id, (tx) =>
      tx.clientBankAccount.findMany({ where: { clientId, active: true }, orderBy: { createdAt: 'desc' } }),
    );
    return accounts.map((a) => ({ id: a.id, iban: maskIban(a.iban), bankName: a.bankName, holderName: a.holderName }));
  }

  async startAddBankAccount(tenant: Tenant, user: AuthUser, input: { iban: string; bankName: string; holderName: string }) {
    const iban = normaliseIban(input.iban);
    if (!isValidEgyptianIban(iban)) throw new BadRequestException('Enter a valid Egyptian IBAN (EG + 27 digits)');
    const client = await this.db.forTenant(tenant.id, (tx) => tx.client.findUniqueOrThrow({ where: { id: user.clientId! } }));
    if (!client.fullNameEn || !holderMatchesClient(input.holderName, client.fullNameEn)) {
      throw new BadRequestException('The account must be in your own name');
    }
    return this.stepUp(tenant, user, { action: 'ADD_BANK_ACCOUNT', tenantId: tenant.id, iban, bankName: input.bankName, holderName: input.holderName });
  }

  async startWithdrawal(tenant: Tenant, user: AuthUser, input: { amount: string; bankAccountId: string }) {
    const clientId = user.clientId!;
    await this.db.forTenant(tenant.id, async (tx) => {
      await this.activeAccount(tx, clientId, input.bankAccountId);
      await this.assertWithdrawable(tx, tenant.id, clientId, new Decimal(input.amount));
    });
    return this.stepUp(tenant, user, { action: 'REQUEST_WITHDRAWAL', tenantId: tenant.id, amount: input.amount, bankAccountId: input.bankAccountId });
  }

  /** Runs the action a verified step-up code authorised. */
  async confirmStepUp(tenant: Tenant, user: AuthUser, challengeId: string, code: string) {
    const { user: owner, payload } = await this.otp.verify(challengeId, code, ['STEP_UP']);
    const action = payload as unknown as StepUpAction | null;
    if (owner.id !== user.sub || !action || action.tenantId !== tenant.id) {
      throw new ForbiddenException('This code was not issued for you');
    }
    const clientId = user.clientId!;
    return this.db.forTenant(tenant.id, async (tx) => {
      if (action.action === 'ADD_BANK_ACCOUNT') {
        await tx.clientBankAccount.updateMany({ where: { clientId, active: true }, data: { active: false } });
        const account = await tx.clientBankAccount.create({
          data: { tenantId: tenant.id, clientId, iban: action.iban, bankName: action.bankName, holderName: action.holderName },
        });
        await this.audit.record(tx, { tenantId: tenant.id, actorId: user.sub, action: 'BANK_ACCOUNT_ADDED', entity: 'Client', entityId: clientId, data: { iban: maskIban(action.iban) } });
        return { action: action.action, bankAccountId: account.id };
      }

      // Withdrawal: re-check under a per-client lock, then hold the cash.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${clientId}))`;
      const amount = new Decimal(action.amount);
      await this.activeAccount(tx, clientId, action.bankAccountId);
      await this.assertWithdrawable(tx, tenant.id, clientId, amount);
      const w = await tx.withdrawal.create({
        data: { tenantId: tenant.id, clientId, bankAccountId: action.bankAccountId, amount: amount.toFixed(2) },
      });
      await this.ledger.post(tx, tenant.id, 'WITHDRAWAL_HOLD', w.id, withdrawalHoldEntry(clientId, amount), user.sub);
      await this.audit.record(tx, { tenantId: tenant.id, actorId: user.sub, action: 'WITHDRAWAL_REQUESTED', entity: 'Withdrawal', entityId: w.id, data: { amount: amount.toFixed(2) } });
      return { action: action.action, withdrawalId: w.id, status: w.status };
    });
  }

  listWithdrawals(tenant: Tenant, clientId?: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const rows = await tx.withdrawal.findMany({
        where: clientId ? { clientId } : {},
        include: { bankAccount: true, client: { select: { fullNameEn: true } } },
        orderBy: { requestedAt: 'desc' },
        take: 200,
      });
      return rows.map((w) => ({
        id: w.id,
        clientId: w.clientId,
        clientName: w.client.fullNameEn,
        amount: w.amount.toFixed(2),
        status: w.status,
        iban: maskIban(w.bankAccount.iban),
        bankName: w.bankAccount.bankName,
        requestedAt: w.requestedAt,
        approvedById: w.approvedById,
        approvedAt: w.approvedAt,
        paidAt: w.paidAt,
        bankReference: w.bankReference,
        rejectReason: w.rejectReason,
      }));
    });
  }

  // --- Broker: withdrawal approval and payout (maker-checker) ---------------------------

  approveWithdrawal(tenant: Tenant, actorId: string, id: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const w = await this.withdrawal(tx, id);
      if (w.status !== 'REQUESTED') throw new ConflictException(`Withdrawal is ${w.status}`);
      await tx.withdrawal.update({ where: { id }, data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() } });
      await this.audit.record(tx, { tenantId: tenant.id, actorId, action: 'WITHDRAWAL_APPROVED', entity: 'Withdrawal', entityId: id });
      return { status: 'APPROVED' };
    });
  }

  rejectWithdrawal(tenant: Tenant, actorId: string, id: string, reason: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const w = await this.withdrawal(tx, id);
      if (w.status !== 'REQUESTED' && w.status !== 'APPROVED') throw new ConflictException(`Withdrawal is ${w.status}`);
      await tx.withdrawal.update({ where: { id }, data: { status: 'REJECTED', rejectReason: reason } });
      await this.ledger.post(tx, tenant.id, 'WITHDRAWAL_RELEASE', id, withdrawalReleaseEntry(w.clientId, w.amount.toString()), actorId);
      await this.audit.record(tx, { tenantId: tenant.id, actorId, action: 'WITHDRAWAL_REJECTED', entity: 'Withdrawal', entityId: id, data: { reason } });
      return { status: 'REJECTED' };
    });
  }

  /** The person who pays out must not be the person who approved (maker-checker). */
  markWithdrawalPaid(tenant: Tenant, actorId: string, id: string, bankReference: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const w = await this.withdrawal(tx, id);
      if (w.status !== 'APPROVED') throw new ConflictException(`Withdrawal is ${w.status}; it must be approved first`);
      if (w.approvedById === actorId) {
        throw new ForbiddenException('A different person must record the payment than the one who approved it');
      }
      await tx.withdrawal.update({ where: { id }, data: { status: 'PAID', paidById: actorId, paidAt: new Date(), bankReference } });
      await this.ledger.post(tx, tenant.id, 'WITHDRAWAL_PAID', id, withdrawalPaidEntry(w.clientId, w.amount.toString()), actorId);
      await this.audit.record(tx, { tenantId: tenant.id, actorId, action: 'WITHDRAWAL_PAID', entity: 'Withdrawal', entityId: id, data: { bankReference } });
      return { status: 'PAID' };
    });
  }

  // --- Broker: settlement with banks ----------------------------------------------------------

  /** Orders with fills whose settlement with the bank has not been confirmed. */
  pendingSettlements(tenant: Tenant) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const orders = await tx.order.findMany({
        where: { settledAt: null, cumQty: { gt: 0 }, ordStatus: { in: SETTLEABLE } },
        include: { priceSnapshot: true, executions: true },
        orderBy: { createdAt: 'asc' },
      });
      const banks = new Map((await tx.bank.findMany()).map((b) => [b.id, b]));
      const today = new Date(new Date().toISOString().slice(0, 10));
      return orders.map((o) => ({
        orderId: o.id,
        clOrdId: o.clOrdId,
        side: o.side === Side.Buy ? 'BUY' : 'SELL',
        isin: o.isin,
        quantity: o.cumQty.toFixed(2),
        bankId: o.bankId,
        bankName: banks.get(o.bankId)?.nameEn ?? o.bankId,
        settlDate: o.priceSnapshot.settlDate,
        overdue: o.priceSnapshot.settlDate < today,
        amount: this.bankAmount(o.executions).toFixed(2),
      }));
    });
  }

  confirmSettlement(tenant: Tenant, actorId: string, orderId: string, reference: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { executions: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.settledAt) return { settled: true, alreadySettled: true };
      if (!SETTLEABLE.includes(order.ordStatus) || !order.cumQty.gt(0)) {
        throw new ConflictException('Only completed orders with fills can settle');
      }
      const amount = this.bankAmount(order.executions);
      const lines = order.side === Side.Buy ? buySettlementEntry(order.bankId, amount) : sellSettlementEntry(order.bankId, amount);
      await this.ledger.post(tx, tenant.id, order.side === Side.Buy ? 'BUY_SETTLED' : 'SELL_SETTLED', order.id, lines, actorId);
      await tx.order.update({ where: { id: order.id }, data: { settledAt: new Date(), settlementRef: reference } });
      await this.audit.record(tx, { tenantId: tenant.id, actorId, action: 'ORDER_SETTLED', entity: 'Order', entityId: order.id, data: { reference, amount: amount.toFixed(2) } });
      return { settled: true, amount: amount.toFixed(2) };
    });
  }

  // --- Broker: revenue sweep ---------------------------------------------------------------------

  async revenue(tenant: Tenant) {
    return this.db.forTenant(tenant.id, async (tx) => ({
      currency: 'EGP',
      unswept: (await this.ledger.balance(tx, tenant.id, { type: LedgerAccountType.BROKER_REVENUE, unit: 'EGP' })).toFixed(2),
    }));
  }

  sweepRevenue(tenant: Tenant, actorId: string, input: { amount: string; bankReference: string }) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const unswept = await this.ledger.balance(tx, tenant.id, { type: LedgerAccountType.BROKER_REVENUE, unit: 'EGP' });
      const amount = new Decimal(input.amount);
      if (amount.gt(unswept)) throw new BadRequestException(`Only EGP ${unswept.toFixed(2)} of revenue is available to sweep`);
      await this.ledger.post(tx, tenant.id, 'REVENUE_SWEEP', input.bankReference, revenueSweepEntry(amount), actorId);
      await this.audit.record(tx, { tenantId: tenant.id, actorId, action: 'REVENUE_SWEPT', entity: 'Tenant', entityId: tenant.id, data: input });
      return { swept: amount.toFixed(2) };
    });
  }

  // --- helpers ------------------------------------------------------------------------------------

  private async stepUp(tenant: Tenant, user: AuthUser, action: StepUpAction) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: user.sub } });
    return this.otp.issue(u, 'STEP_UP', this.identity.senderName(tenant), action as unknown as Prisma.InputJsonValue);
  }

  private async assertWithdrawable(tx: Tx, tenantId: string, clientId: string, amount: Decimal) {
    if (!amount.gt(0)) throw new BadRequestException('Amount must be positive');
    const available = await this.ledger.balance(tx, tenantId, { type: LedgerAccountType.CLIENT_CASH_AVAILABLE, unit: 'EGP', clientId });
    const withdrawable = withdrawableCash(available, await this.unsettledSaleProceeds(tx, clientId));
    if (amount.gt(withdrawable)) {
      throw new BadRequestException(
        `You can withdraw up to EGP ${withdrawable.toFixed(2)} now; sale proceeds become withdrawable once the bank settles`,
      );
    }
  }

  private async activeAccount(tx: Tx, clientId: string, bankAccountId: string) {
    const account = await tx.clientBankAccount.findUnique({ where: { id: bankAccountId } });
    if (!account || account.clientId !== clientId || !account.active) throw new BadRequestException('Bank account not found');
    return account;
  }

  private async withdrawal(tx: Tx, id: string) {
    const w = await tx.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    return w;
  }

  private bankAmount(executions: { execType: string; bankAmount: Prisma.Decimal | null }[]): Decimal {
    return executions
      .filter((e) => e.execType === ExecType.Trade)
      .reduce((sum, e) => sum.plus(e.bankAmount?.toString() ?? 0), new Decimal(0));
  }
}

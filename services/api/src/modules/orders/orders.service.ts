import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Prisma, Tenant } from '@prisma/client';
import {
  ExecType,
  MsgType,
  OrdStatus,
  OrdType,
  PriceType,
  SecurityIDSource,
  Side,
  type ExecutionReportMsg,
} from '@agyal/shared-types';
import { AuditService } from '../../common/audit.service';
import { newId } from '../../common/crypto.util';
import { DbService, type Tx } from '../../common/db.service';
import { tenantConfig } from '../../common/tenant-config';
import {
  buyFillEntry,
  LedgerAccountType,
  positionReleaseEntry,
  positionReserveEntry,
  releaseEntry,
  reserveEntry,
  sellFillEntry,
} from '../../domain/ledger-rules';
import { isInstrumentSuitable } from '../../domain/onboarding-rules';
import { applyExecution } from '../../domain/order-state';
import { disclosureText, type TradeSide } from '../../domain/pricing';
import { FixOutboxService } from '../bank-adapters/fix-outbox.service';
import { InstrumentsService } from '../instruments/instruments.service';
import { LedgerService } from '../ledger/ledger.service';
import { bankPriceFor, PricingService, tradeSide } from '../pricing/pricing.service';
import { fixDate, orderParties, parseFixDate } from '../rfq/rfq.service';

type ClientWithCustody = Prisma.ClientGetPayload<{ include: { investorCode: true; custodyAccounts: true } }>;

/** FIX-native order management (ADR 0003): one order per client, against a bank quote. */
@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private readonly db: DbService,
    private readonly instruments: InstrumentsService,
    private readonly pricing: PricingService,
    private readonly ledger: LedgerService,
    private readonly outbox: FixOutboxService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Client accepts a quote: pre-trade checks, price snapshot, reservation of
   * cash (buy) or securities (sell), then NewOrderSingle to the bank.
   */
  async accept(tenant: Tenant, userId: string, clientId: string, quoteRowId: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      // Serialise order acceptance per client so two orders cannot spend the same cash or securities.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${clientId}))`;

      const quote = await tx.quote.findUnique({
        where: { id: quoteRowId },
        include: { quoteRequest: true },
      });
      if (!quote || quote.quoteRequest.clientId !== clientId) throw new NotFoundException('Quote not found');
      if (quote.validUntil <= new Date()) throw new ConflictException('This price has expired, request a new one');
      if (await tx.order.findUnique({ where: { quoteId: quote.id } })) {
        throw new ConflictException('This quote was already accepted');
      }

      const request = quote.quoteRequest;
      const side = tradeSide(request.side);
      const instrument = await this.instruments.byIsin(tenant, request.isin);
      const client = await tx.client.findUniqueOrThrow({
        where: { id: clientId },
        include: { investorCode: true, custodyAccounts: true },
      });
      this.preTradeChecks(side, client, instrument);

      const bank = await tx.bank.findUniqueOrThrow({ where: { id: quote.bankId } });
      const relation = await tx.brokerBankRelationship.findUnique({
        where: { tenantId_bankId: { tenantId: tenant.id, bankId: bank.id } },
      });
      if (!relation?.active) throw new ConflictException('Bank relationship is not active');

      const bankPx = bankPriceFor(quote, side);
      if (!bankPx) throw new ConflictException('Quote has no price for this side');
      const quantity = request.orderQty.toString();
      const price = this.pricing.price(tenant, side, instrument, bankPx, quantity, request.settlDate);

      const clOrdId = newId('O');
      let reservedAmount = new Decimal(0);
      let reservedQty = new Decimal(0);
      if (side === 'BUY') {
        const bufferBps = tenantConfig(tenant.config).reserveBufferBps;
        reservedAmount = new Decimal(price.netAmount)
          .plus(new Decimal(price.principal).mul(bufferBps).div(10_000))
          .toDecimalPlaces(2, Decimal.ROUND_UP);
        const available = await this.ledger.balance(tx, tenant.id, {
          type: LedgerAccountType.CLIENT_CASH_AVAILABLE,
          unit: 'EGP',
          clientId,
        });
        if (available.lt(reservedAmount)) {
          throw new BadRequestException(
            `Insufficient cash: EGP ${reservedAmount.toFixed(2)} needed, EGP ${available.toFixed(2)} available`,
          );
        }
      } else {
        reservedQty = new Decimal(quantity);
        const free = await this.ledger.balance(tx, tenant.id, {
          type: LedgerAccountType.CLIENT_POSITION,
          unit: instrument.isin,
          clientId,
        });
        if (free.lt(reservedQty)) {
          throw new BadRequestException(
            `Insufficient holding: ${reservedQty.toFixed(2)} needed, ${free.toFixed(2)} free to sell`,
          );
        }
      }

      const snapshot = await tx.priceSnapshot.create({
        data: {
          tenantId: tenant.id,
          quoteId: quote.id,
          side,
          pricingRule: price.rule as unknown as Prisma.InputJsonValue,
          bankCleanPx: price.bankCleanPx,
          bankYield: price.bankYield,
          markupBps: price.markupBps,
          clientCleanPx: price.clientCleanPx,
          clientYield: price.clientYield,
          accruedInterest: price.accruedInterest,
          principal: price.principal,
          commission: price.commission,
          netAmount: price.netAmount,
          settlDate: request.settlDate,
          disclosure: disclosureText(side, price),
        },
      });
      const order = await tx.order.create({
        data: {
          tenantId: tenant.id,
          clOrdId,
          clientId,
          bankId: bank.id,
          quoteId: quote.id,
          isin: instrument.isin,
          side: request.side,
          ordType: OrdType.PreviouslyQuoted,
          orderQty: quantity,
          ordStatus: OrdStatus.PendingNew,
          reservedAmount: reservedAmount.toFixed(2),
          reservedQty: reservedQty.toFixed(2),
          priceSnapshotId: snapshot.id,
        },
      });
      if (side === 'BUY') {
        await this.ledger.post(tx, tenant.id, 'ORDER_RESERVE', clOrdId, reserveEntry(clientId, reservedAmount), userId);
      } else {
        await this.ledger.post(
          tx,
          tenant.id,
          'POSITION_RESERVE',
          clOrdId,
          positionReserveEntry(clientId, instrument.isin, reservedQty),
          userId,
        );
      }
      await this.outbox.enqueue(tx, bank, {
        msgType: MsgType.NewOrderSingle,
        clOrdId,
        quoteId: quote.quoteId,
        instrument: { securityId: instrument.isin, securityIdSource: SecurityIDSource.Isin },
        side: request.side as Side,
        orderQty: quantity,
        ordType: OrdType.PreviouslyQuoted,
        priceType: PriceType.PercentageOfPar,
        price: price.bankCleanPx,
        settlDate: fixDate(request.settlDate),
        parties: orderParties(relation.brokerAccountAtBank, client.investorCode!.code!),
        transactTime: new Date().toISOString(),
      });
      await this.audit.record(tx, {
        tenantId: tenant.id,
        actorId: userId,
        action: 'ORDER_ACCEPTED',
        entity: 'Order',
        entityId: order.id,
        data: { clOrdId, side, quoteId: quote.quoteId, bankId: bank.id, netAmount: price.netAmount },
      });
      return this.view(order, snapshot);
    });
  }

  list(tenant: Tenant, clientId?: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const orders = await tx.order.findMany({
        where: clientId ? { clientId } : {},
        include: { priceSnapshot: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return orders.map((o) => ({ ...this.view(o, o.priceSnapshot), clientId: o.clientId }));
    });
  }

  async get(tenant: Tenant, clientId: string, id: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { priceSnapshot: true, executions: { orderBy: { createdAt: 'asc' } } },
      });
      if (!order || order.clientId !== clientId) throw new NotFoundException();
      return {
        ...this.view(order, order.priceSnapshot),
        executions: order.executions.map((e) => ({
          execType: e.execType,
          ordStatus: e.ordStatus,
          lastQty: e.lastQty?.toFixed(2) ?? null,
          clientAmount: e.clientAmount?.toFixed(2) ?? null,
          settlDate: e.settlDate,
          transactTime: e.transactTime,
        })),
      };
    });
  }

  /** Looks up which tenant an inbound ExecutionReport belongs to (platform scope). */
  tenantForClOrdId(clOrdId: string) {
    return this.db.asSystem((tx) => tx.order.findUnique({ where: { clOrdId }, select: { tenantId: true } }));
  }

  /** Inbound ExecutionReport <8>: advance the FIX state machine and post to the ledger. */
  async onExecutionReport(tx: Tx, bankId: string, msg: ExecutionReportMsg) {
    const order = await tx.order.findUnique({
      where: { clOrdId: msg.clOrdId },
      include: { priceSnapshot: true },
    });
    if (!order) throw new Error(`Unknown ClOrdID ${msg.clOrdId}`);
    if (order.bankId !== bankId) throw new Error('ExecutionReport from a different bank');
    if (await tx.execution.findUnique({ where: { bankId_execId: { bankId, execId: msg.execId } } })) {
      return; // duplicate (e.g. FIX resend) - already applied
    }
    const side = tradeSide(order.side);

    const outcome = applyExecution(
      { ordStatus: order.ordStatus as OrdStatus, orderQty: order.orderQty.toString(), cumQty: order.cumQty.toString() },
      { execType: msg.execType, ordStatus: msg.ordStatus, lastQty: msg.lastQty },
    );

    let clientAmount: Decimal | null = null;
    let bankAmount: Decimal | null = null;
    if (msg.execType === ExecType.Trade) {
      const snap = order.priceSnapshot;
      const qty = outcome.filledQty;
      const accrued = new Decimal(msg.accruedInterestAmt ?? 0);
      const bankTotal = qty.mul(msg.lastPx ?? 0).div(100).toDecimalPlaces(2).plus(accrued);
      bankAmount = bankTotal;
      const commissionShare = new Decimal(snap.commission.toString())
        .mul(qty)
        .div(order.orderQty.toString())
        .toDecimalPlaces(2);
      const clientGross = qty.mul(snap.clientCleanPx.toString()).div(100).toDecimalPlaces(2).plus(accrued);
      clientAmount = side === 'BUY' ? clientGross.plus(commissionShare) : clientGross.minus(commissionShare);

      const lastPx = new Decimal(msg.lastPx ?? 0);
      const worse = side === 'BUY' ? lastPx.gt(snap.bankCleanPx.toString()) : lastPx.lt(snap.bankCleanPx.toString());
      if (worse) this.log.warn(`Order ${order.clOrdId} filled at a worse price than quoted`);

      const fill = { clientId: order.clientId, bankId, isin: order.isin, quantity: qty, clientTotal: clientAmount, bankTotal };
      await this.ledger.post(
        tx,
        order.tenantId,
        side === 'BUY' ? 'BUY_FILL' : 'SELL_FILL',
        `${bankId}:${msg.execId}`,
        side === 'BUY' ? buyFillEntry(fill) : sellFillEntry(fill),
      );
    }

    await tx.execution.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        bankId,
        execId: msg.execId,
        execType: msg.execType,
        ordStatus: msg.ordStatus,
        lastQty: msg.lastQty ?? null,
        lastPx: msg.lastPx ?? null,
        accruedInterestAmt: msg.accruedInterestAmt ?? null,
        netMoney: msg.netMoney ?? null,
        clientAmount: clientAmount?.toFixed(2) ?? null,
        bankAmount: bankAmount?.toFixed(2) ?? null,
        settlDate: msg.settlDate ? parseFixDate(msg.settlDate) : null,
        transactTime: new Date(msg.transactTime),
        text: msg.text ?? null,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        ordStatus: outcome.ordStatus,
        cumQty: outcome.cumQty.toFixed(2),
        orderId: msg.orderId,
        text: msg.text ?? order.text,
      },
    });

    if (outcome.terminal) await this.releaseRemainder(tx, order, outcome.cumQty, side);
  }

  /** Order finished: return unused reserved cash (buy) or unsold reserved securities (sell). */
  private async releaseRemainder(
    tx: Tx,
    order: { id: string; tenantId: string; clientId: string; clOrdId: string; isin: string; reservedAmount: Prisma.Decimal; reservedQty: Prisma.Decimal },
    cumQty: Decimal,
    side: TradeSide,
  ) {
    if (side === 'SELL') {
      const unsold = new Decimal(order.reservedQty.toString()).minus(cumQty);
      if (unsold.gt(0)) {
        await this.ledger.post(tx, order.tenantId, 'POSITION_RELEASE', order.clOrdId, positionReleaseEntry(order.clientId, order.isin, unsold));
      }
      return;
    }
    const spent = await tx.execution.aggregate({ where: { orderId: order.id }, _sum: { clientAmount: true } });
    const remaining = new Decimal(order.reservedAmount.toString()).minus(spent._sum.clientAmount?.toString() ?? 0);
    if (remaining.isNegative()) {
      this.log.warn(`Order ${order.clOrdId} cost EGP ${remaining.neg()} more than reserved`);
    }
    if (!remaining.isZero()) {
      await this.ledger.post(tx, order.tenantId, 'ORDER_RELEASE', order.clOrdId, releaseEntry(order.clientId, remaining));
    }
  }

  private preTradeChecks(side: TradeSide, client: ClientWithCustody, instrument: { type: string; depository: string }) {
    if (client.status !== 'ACTIVE') throw new ForbiddenException('Account is not active');
    if (client.investorCode?.status !== 'VERIFIED' || !client.investorCode.code) {
      throw new ForbiddenException('Your unified investor code is not verified yet');
    }
    if (!client.custodyAccounts.some((a) => a.active && a.depository === instrument.depository)) {
      throw new ForbiddenException(`No active custody account at ${instrument.depository} yet`);
    }
    // Buying needs current KYC and a suitable profile; a client can always sell what they hold.
    if (side === 'BUY') {
      if (client.kycReviewDueAt && client.kycReviewDueAt < new Date()) {
        throw new ForbiddenException('KYC review is overdue; please update your details');
      }
      if (!client.riskProfile || !isInstrumentSuitable(client.riskProfile, instrument.type)) {
        throw new ForbiddenException('This instrument is not suitable for your risk profile');
      }
    }
  }

  private view(
    o: { id: string; clOrdId: string; isin: string; side: string; orderQty: Prisma.Decimal; ordStatus: string; cumQty: Prisma.Decimal; text: string | null; createdAt: Date },
    s: { clientCleanPx: Prisma.Decimal; clientYield: Prisma.Decimal | null; principal: Prisma.Decimal; accruedInterest: Prisma.Decimal; commission: Prisma.Decimal; netAmount: Prisma.Decimal; settlDate: Date; disclosure: string },
  ) {
    return {
      id: o.id,
      clOrdId: o.clOrdId,
      isin: o.isin,
      side: tradeSide(o.side),
      quantity: o.orderQty.toFixed(2),
      ordStatus: o.ordStatus,
      cumQty: o.cumQty.toFixed(2),
      text: o.text,
      createdAt: o.createdAt,
      price: {
        clientCleanPx: s.clientCleanPx.toFixed(6),
        clientYield: s.clientYield?.toFixed(6) ?? null,
        principal: s.principal.toFixed(2),
        accruedInterest: s.accruedInterest.toFixed(2),
        commission: s.commission.toFixed(2),
        netAmount: s.netAmount.toFixed(2),
        settlDate: s.settlDate,
        disclosure: s.disclosure,
      },
    };
  }
}

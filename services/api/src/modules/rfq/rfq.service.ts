import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Tenant } from '@prisma/client';
import {
  MsgType,
  PriceType,
  SecurityIDSource,
  Side,
  type Party,
  type QuoteMsg,
} from '@agyal/shared-types';
import { newId } from '../../common/crypto.util';
import { DbService, type Tx } from '../../common/db.service';
import { isInstrumentSuitable } from '../../domain/onboarding-rules';
import { FixOutboxService } from '../bank-adapters/fix-outbox.service';
import { InstrumentsService } from '../instruments/instruments.service';
import { PricingService } from '../pricing/pricing.service';

/** FIX PartyRole(452) values used in NoPartyIDs; confirmed per bank (docs/fix/banks). */
export const PARTY_ROLE = { EXECUTING_FIRM: 1, CLIENT_ID: 3 } as const;
/** PartyIDSource(447) D = proprietary/custom code */
export const PARTY_SOURCE_PROPRIETARY = 'D';

export function fixDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function parseFixDate(s: string): Date {
  return new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
}

export function orderParties(brokerAccountAtBank: string, unifiedCode: string): Party[] {
  return [
    { partyId: brokerAccountAtBank, partyIdSource: PARTY_SOURCE_PROPRIETARY, partyRole: PARTY_ROLE.EXECUTING_FIRM },
    { partyId: unifiedCode, partyIdSource: PARTY_SOURCE_PROPRIETARY, partyRole: PARTY_ROLE.CLIENT_ID },
  ];
}

/** Request for quote across the broker's partner banks (ADR 0003). */
@Injectable()
export class RfqService {
  private readonly log = new Logger(RfqService.name);

  constructor(
    private readonly db: DbService,
    private readonly instruments: InstrumentsService,
    private readonly pricing: PricingService,
    private readonly outbox: FixOutboxService,
  ) {}

  async create(tenant: Tenant, clientId: string, input: { isin: string; quantity: string }) {
    const instrument = await this.instruments.byIsin(tenant, input.isin);
    const qty = new Decimal(input.quantity);
    const min = new Decimal(instrument.minQty.toString());
    const step = new Decimal(instrument.qtyIncrement.toString());
    if (qty.lt(min) || !qty.minus(min).mod(step).isZero()) {
      throw new BadRequestException(`Quantity must be at least ${min} in steps of ${step}`);
    }
    const settlDate = this.pricing.settlementDate(tenant);
    if (settlDate >= instrument.maturityDate) throw new BadRequestException('Instrument matures before settlement');

    return this.db.forTenant(tenant.id, async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        include: { investorCode: true },
      });
      if (!client || client.status !== 'ACTIVE') {
        throw new ForbiddenException('Your account must be approved before requesting prices');
      }
      if (!client.riskProfile || !isInstrumentSuitable(client.riskProfile, instrument.type)) {
        throw new ForbiddenException('This instrument is not suitable for your risk profile');
      }
      const relations = await tx.brokerBankRelationship.findMany({
        where: { active: true, bank: { active: true } },
        include: { bank: true },
      });
      if (relations.length === 0) throw new BadRequestException('No partner banks are connected');

      const quoteReqId = newId('QR');
      const request = await tx.quoteRequest.create({
        data: {
          tenantId: tenant.id,
          quoteReqId,
          clientId,
          isin: instrument.isin,
          side: Side.Buy,
          orderQty: qty.toFixed(2),
          settlDate,
        },
      });
      for (const rel of relations) {
        await this.outbox.enqueue(tx, rel.bank, {
          msgType: MsgType.QuoteRequest,
          quoteReqId,
          instrument: { securityId: instrument.isin, securityIdSource: SecurityIDSource.Isin },
          side: Side.Buy,
          orderQty: qty.toFixed(2),
          settlDate: fixDate(settlDate),
          parties: orderParties(rel.brokerAccountAtBank, client.investorCode?.code ?? 'PENDING'),
        });
      }
      return { id: request.id, quoteReqId, banks: relations.length };
    });
  }

  /** The client's RFQ with live quotes priced for the client, best first (ADR 0008). */
  async get(tenant: Tenant, clientId: string, id: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const request = await tx.quoteRequest.findUnique({ where: { id }, include: { quotes: true } });
      if (!request || request.clientId !== clientId) throw new NotFoundException();
      const instrument = await this.instruments.byIsin(tenant, request.isin);
      const now = new Date();
      const orders = await tx.order.findMany({
        where: { quoteId: { in: request.quotes.map((q) => q.id) } },
        select: { quoteId: true },
      });
      const used = new Set(orders.map((o) => o.quoteId));
      const quotes = request.quotes
        .filter((q) => q.validUntil > now && !used.has(q.id))
        .flatMap((q) => {
          let p;
          try {
            p = this.pricing.priceBuy(
              tenant,
              instrument,
              q.offerPx.toString(),
              request.orderQty.toString(),
              request.settlDate,
            );
          } catch (err) {
            this.log.warn(`Skipping unpriceable quote ${q.quoteId}: ${(err as Error).message}`);
            return [];
          }
          // Clients only see their own price, never the bank price or markup (ADR 0008).
          return [{
            quoteId: q.id,
            validUntil: q.validUntil,
            clientCleanPx: p.clientCleanPx,
            clientYield: p.clientYield,
            principal: p.principal,
            accruedInterest: p.accruedInterest,
            commission: p.commission,
            totalCost: p.totalCost,
          }];
        })
        .sort((a, b) => Number(b.clientYield) - Number(a.clientYield));
      return {
        id: request.id,
        isin: request.isin,
        quantity: request.orderQty.toFixed(2),
        settlDate: request.settlDate,
        instrument: { nameEn: instrument.nameEn, nameAr: instrument.nameAr, type: instrument.type },
        quotes,
      };
    });
  }

  /** Inbound Quote <S> from a bank, routed here by the FIX inbox processor. */
  async onQuote(tx: Tx, bankId: string, msg: QuoteMsg) {
    const request = await tx.quoteRequest.findUnique({ where: { quoteReqId: msg.quoteReqId } });
    if (!request) throw new Error(`Unknown QuoteReqID ${msg.quoteReqId}`);
    if (msg.instrument.securityId !== request.isin) throw new Error('Quote for a different instrument');
    if (!msg.offerPx) throw new Error('Quote without OfferPx');
    if (msg.priceType !== PriceType.PercentageOfPar) {
      throw new Error(`Unsupported PriceType ${msg.priceType}`);
    }
    await tx.quote.upsert({
      where: { bankId_quoteId: { bankId, quoteId: msg.quoteId } },
      create: {
        tenantId: request.tenantId,
        quoteRequestId: request.id,
        bankId,
        quoteId: msg.quoteId,
        priceType: msg.priceType,
        offerPx: msg.offerPx,
        offerYield: msg.offerYield ?? null,
        validUntil: new Date(msg.validUntilTime),
      },
      update: {},
    });
  }

  /** Looks up which tenant an inbound quote belongs to (platform scope). */
  tenantForQuoteRequest(quoteReqId: string) {
    return this.db.asSystem((tx) =>
      tx.quoteRequest.findUnique({ where: { quoteReqId }, select: { tenantId: true } }),
    );
  }

  logReject(bankId: string, quoteReqId: string, text?: string) {
    this.log.warn(`Bank ${bankId} rejected QuoteRequest ${quoteReqId}: ${text ?? 'no reason'}`);
  }
}

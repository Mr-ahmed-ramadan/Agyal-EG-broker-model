import { Injectable } from '@nestjs/common';
import type { Instrument, Quote, Tenant } from '@prisma/client';
import { Side } from '@agyal/shared-types';
import { EconomicsService } from '../../common/economics.service';
import { tenantConfig } from '../../common/tenant-config';
import { addBusinessDays } from '../../domain/fixed-income';
import { priceClient, type ClientPrice, type PricingRule, type TradeSide } from '../../domain/pricing';

export function tradeSide(fixSide: string): TradeSide {
  if (fixSide === Side.Buy) return 'BUY';
  if (fixSide === Side.Sell) return 'SELL';
  throw new Error(`Unsupported Side ${fixSide}`);
}

/** The bank price that answers the client's side: offer for a buy, bid for a sell. */
export function bankPriceFor(quote: Pick<Quote, 'offerPx' | 'bidPx'>, side: TradeSide): string | null {
  const px = side === 'BUY' ? quote.offerPx : quote.bidPx;
  return px ? px.toString() : null;
}

/** All client-rate logic goes through here (ADR 0008). */
@Injectable()
export class PricingService {
  constructor(private readonly economics: EconomicsService) {}

  settlementDate(tenant: Tenant, tradeDate = new Date()): Date {
    return addBusinessDays(tradeDate, tenantConfig(tenant.config).settlementDays);
  }

  /** The broker's pricing rule: total yield deduction (custody + broker + platform) and commission. */
  rule(tenant: Tenant): Promise<PricingRule> {
    return this.economics.rule(tenant);
  }

  async price(
    tenant: Tenant,
    side: TradeSide,
    instrument: Instrument,
    bankCleanPx: string,
    quantity: string,
    settlDate: Date,
    rule?: PricingRule,
  ): Promise<ClientPrice & { rule: PricingRule }> {
    const r = rule ?? (await this.rule(tenant));
    const price = priceClient({
      side,
      instrument: {
        type: instrument.type,
        couponRate: instrument.couponRate == null ? null : Number(instrument.couponRate),
        couponFreq: instrument.couponFreq,
        maturityDate: instrument.maturityDate,
      },
      bankCleanPx: Number(bankCleanPx),
      quantity,
      settlDate,
      rule: r,
    });
    return { ...price, rule: r };
  }
}

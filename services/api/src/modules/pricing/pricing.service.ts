import { Injectable } from '@nestjs/common';
import type { Instrument, Tenant } from '@prisma/client';
import { tenantConfig } from '../../common/tenant-config';
import { addBusinessDays } from '../../domain/fixed-income';
import {
  priceClientBuy,
  resolvePricingRule,
  type ClientPrice,
  type PricingRule,
} from '../../domain/pricing';

/** All client-rate logic goes through here (ADR 0008). */
@Injectable()
export class PricingService {
  settlementDate(tenant: Tenant, tradeDate = new Date()): Date {
    return addBusinessDays(tradeDate, tenantConfig(tenant.config).settlementDays);
  }

  rule(tenant: Tenant, instrument: Instrument): PricingRule {
    return resolvePricingRule(tenantConfig(tenant.config).pricing, instrument.type);
  }

  priceBuy(
    tenant: Tenant,
    instrument: Instrument,
    bankCleanPx: string,
    quantity: string,
    settlDate: Date,
  ): ClientPrice & { rule: PricingRule } {
    const rule = this.rule(tenant, instrument);
    const price = priceClientBuy({
      instrument: {
        type: instrument.type,
        couponRate: instrument.couponRate == null ? null : Number(instrument.couponRate),
        couponFreq: instrument.couponFreq,
        maturityDate: instrument.maturityDate,
      },
      bankCleanPx: Number(bankCleanPx),
      quantity,
      settlDate,
      rule,
    });
    return { ...price, rule };
  }
}

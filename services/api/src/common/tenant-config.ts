import type { InstrumentType, PricingConfig } from '../domain/pricing';
import type { AutoApprovalRule } from '../domain/onboarding-rules';

/** Per-broker configuration stored in Tenant.config (ADR 0002). */
export interface TenantConfig {
  enabledInstrumentTypes: string[];
  pricing: PricingConfig;
  autoApproval: AutoApprovalRule;
  /** Business days from trade date to settlement */
  settlementDays: number;
  /** Extra cash reserved on top of the quoted total, in bps of principal */
  reserveBufferBps: number;
  /**
   * Tax withheld on interest, as a fraction (0.2 = 20%), by instrument type:
   * on coupons, and on a T-bill's discount at maturity. Defaults to 20% for
   * every type; the broker's tax adviser should confirm per instrument and
   * client type.
   */
  taxRates: Partial<Record<InstrumentType, number>>;
}

export const DEFAULT_TAX_RATE = 0.2;

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  enabledInstrumentTypes: ['TREASURY_BILL', 'TREASURY_BOND', 'CORPORATE_BOND', 'SUKUK'],
  pricing: {
    default: { markupBps: 50, commissionBps: 10, commissionMin: '25.00' },
    byInstrumentType: { TREASURY_BILL: { markupBps: 25 } },
    maxMarkupBps: 300,
  },
  autoApproval: { enabled: true, maxRiskRating: 'LOW', version: 'default-v1' },
  settlementDays: 1,
  reserveBufferBps: 10,
  taxRates: { TREASURY_BILL: 0.2, TREASURY_BOND: 0.2, CORPORATE_BOND: 0.2, SUKUK: 0.2 },
};

export function tenantConfig(raw: unknown): TenantConfig {
  const c = (raw ?? {}) as Partial<TenantConfig>;
  return { ...DEFAULT_TENANT_CONFIG, ...c };
}

/** Tax rate on interest for an instrument type under this broker's config. */
export function taxRateFor(config: TenantConfig, type: string): number {
  return config.taxRates?.[type as InstrumentType] ?? DEFAULT_TAX_RATE;
}

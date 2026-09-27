import type { PricingConfig } from '../domain/pricing';
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
   * Tax withheld from coupons, as a fraction (0.2 = 20%). Default 0 until the
   * broker's tax adviser confirms the rule per instrument and client type.
   */
  couponWithholdingRate: number;
}

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
  couponWithholdingRate: 0,
};

export function tenantConfig(raw: unknown): TenantConfig {
  const c = (raw ?? {}) as Partial<TenantConfig>;
  return { ...DEFAULT_TENANT_CONFIG, ...c };
}

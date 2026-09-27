import type { AutoApprovalRule } from '../domain/onboarding-rules';

/**
 * Per-broker configuration stored in Tenant.config (ADR 0002). Pricing, tax
 * and deposit rates live in `economics` (overrides of the platform defaults,
 * see EconomicsService).
 */
export interface TenantConfig {
  enabledInstrumentTypes: string[];
  autoApproval: AutoApprovalRule;
  /** Business days from trade date to settlement */
  settlementDays: number;
  /** Extra cash reserved on top of the quoted total, in bps of principal */
  reserveBufferBps: number;
}

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  enabledInstrumentTypes: ['TREASURY_BILL', 'TREASURY_BOND', 'CORPORATE_BOND', 'SUKUK'],
  autoApproval: { enabled: true, maxRiskRating: 'LOW', version: 'default-v1' },
  settlementDays: 1,
  reserveBufferBps: 10,
};

export function tenantConfig(raw: unknown): TenantConfig {
  const c = (raw ?? {}) as Partial<TenantConfig>;
  return { ...DEFAULT_TENANT_CONFIG, ...c };
}


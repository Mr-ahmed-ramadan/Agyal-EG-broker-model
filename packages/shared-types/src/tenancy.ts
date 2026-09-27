/** White-label branding for one broker tenant (ADR 0002). */
export interface TenantBranding {
  tenantSlug: string;
  displayName: { en: string; ar: string };
  logoUrl: string;
  faviconUrl?: string;
  colors: {
    primary: string;
    primaryContrast: string;
    accent: string;
  };
  supportEmail: string;
  supportPhone?: string;
  legalDocuments: {
    termsUrl: string;
    riskDisclosureUrl: string;
    privacyUrl: string;
  };
}

export type InstrumentType = 'TREASURY_BOND' | 'TREASURY_BILL' | 'CORPORATE_BOND' | 'SUKUK';

export type BankConnectionMode = 'FIX' | 'PORTAL' | 'FILE';

export type TenantRole =
  | 'CLIENT'
  | 'BROKER_ADMIN'
  | 'BROKER_COMPLIANCE'
  | 'BROKER_DEALER'
  | 'BROKER_OPS'
  | 'BROKER_FINANCE';

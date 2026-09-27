import type { TenantBranding } from '@agyal/shared-types';

/**
 * Local-dev branding. In production the app fetches the tenant's branding
 * from the API, resolved from the request host (ADR 0002).
 */
export const demoBranding: TenantBranding = {
  tenantSlug: 'demo-broker',
  displayName: { en: 'Demo Securities', ar: 'ديمو للأوراق المالية' },
  logoUrl: '',
  colors: { primary: '#0b4f6c', primaryContrast: '#ffffff', accent: '#c28f2c' },
  supportEmail: 'support@demo-broker.example',
  legalDocuments: {
    termsUrl: '#',
    riskDisclosureUrl: '#',
    privacyUrl: '#',
  },
};

export function applyBranding(branding: TenantBranding) {
  const root = document.documentElement.style;
  root.setProperty('--brand-primary', branding.colors.primary);
  root.setProperty('--brand-primary-contrast', branding.colors.primaryContrast);
  root.setProperty('--brand-accent', branding.colors.accent);
}

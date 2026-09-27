import { createContext, useContext } from 'react';
import { messages, type Locale, type MessageKey } from './i18n/messages';

export interface TenantInfo {
  slug: string;
  legalNameEn: string;
  legalNameAr: string;
  branding: {
    displayName: { en: string; ar: string };
    logoUrl: string;
    colors: { primary: string; primaryContrast: string; accent: string };
    supportEmail: string;
    legalDocuments: { termsUrl: string; riskDisclosureUrl: string; privacyUrl: string };
  };
}

export interface AppCtx {
  locale: Locale;
  tenant: TenantInfo;
  t: (key: MessageKey | string) => string;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext missing');
  return ctx;
}

export function translator(locale: Locale) {
  const dict = messages[locale] as Record<string, string>;
  return (key: string) => dict[key] ?? key;
}

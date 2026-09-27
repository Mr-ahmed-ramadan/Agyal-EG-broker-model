export type Locale = 'en' | 'ar';

export const messages = {
  en: {
    tagline: 'Treasury bonds, T-bills, corporate bonds and sukuk - online.',
    openAccount: 'Open an account',
    switchLanguage: 'العربية',
  },
  ar: {
    tagline: 'سندات الخزانة وأذون الخزانة وسندات الشركات والصكوك - أونلاين.',
    openAccount: 'افتح حساب',
    switchLanguage: 'English',
  },
} satisfies Record<Locale, Record<string, string>>;

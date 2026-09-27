import { useEffect, useState } from 'react';
import { applyBranding, demoBranding } from './branding/demoBranding';
import { messages, type Locale } from './i18n/messages';

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const t = messages[locale];
  const branding = demoBranding;

  useEffect(() => applyBranding(branding), [branding]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.title = branding.displayName[locale];
  }, [locale, branding]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: 'var(--brand-primary)' }}>{branding.displayName[locale]}</h1>
        <button onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>{t.switchLanguage}</button>
      </header>
      <p>{t.tagline}</p>
      <button
        style={{
          background: 'var(--brand-primary)',
          color: 'var(--brand-primary-contrast)',
          border: 0,
          padding: '12px 20px',
          borderRadius: 8,
        }}
      >
        {t.openAccount}
      </button>
    </main>
  );
}

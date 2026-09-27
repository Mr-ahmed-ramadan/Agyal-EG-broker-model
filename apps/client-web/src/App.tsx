import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppContext, translator, type TenantInfo } from './context';
import type { Locale } from './i18n/messages';
import { api, getToken, setToken } from './lib/api';
import { AuthPage } from './pages/AuthPage';
import { MarketsPage } from './pages/MarketsPage';
import { OnboardingPage, type OnboardingStatus } from './pages/OnboardingPage';
import { PortfolioPage } from './pages/PortfolioPage';

type Tab = 'markets' | 'portfolio';

function applyBranding(tenant: TenantInfo) {
  const root = document.documentElement.style;
  root.setProperty('--brand', tenant.branding.colors.primary);
  root.setProperty('--brand-contrast', tenant.branding.colors.primaryContrast);
  root.setProperty('--accent', tenant.branding.colors.accent);
}

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setTok] = useState<string | null>(getToken());
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [tab, setTab] = useState<Tab>('markets');

  const t = useMemo(() => translator(locale), [locale]);

  useEffect(() => {
    api<TenantInfo>('GET', '/tenant')
      .then((tn) => {
        setTenant(tn);
        applyBranding(tn);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    if (tenant) document.title = tenant.branding.displayName[locale];
  }, [locale, tenant]);

  const refreshStatus = useCallback(async () => {
    if (!getToken()) return;
    try {
      setStatus(await api<OnboardingStatus>('GET', '/onboarding'));
    } catch {
      setToken(null);
      setTok(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [token, refreshStatus]);

  const signIn = (tok: string) => {
    setToken(tok);
    setTok(tok);
  };
  const signOut = () => {
    setToken(null);
    setTok(null);
    setStatus(null);
  };

  if (error) return <main className="container"><p className="error">{error}</p></main>;
  if (!tenant) return <main className="container"><p>{t('loading')}</p></main>;

  const active = status?.clientStatus === 'ACTIVE';

  return (
    <AppContext.Provider value={{ locale, tenant, t }}>
      <header className="topbar">
        <div className="brand">
          {tenant.branding.logoUrl ? <img src={tenant.branding.logoUrl} alt="" /> : null}
          <span>{tenant.branding.displayName[locale]}</span>
        </div>
        <nav>
          {token && active ? (
            <>
              <button className={`tab ${tab === 'markets' ? 'on' : ''}`} onClick={() => setTab('markets')}>
                {t('markets')}
              </button>
              <button className={`tab ${tab === 'portfolio' ? 'on' : ''}`} onClick={() => setTab('portfolio')}>
                {t('portfolio')}
              </button>
            </>
          ) : null}
          <button className="link" onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>
            {t('switchLanguage')}
          </button>
          {token ? (
            <button className="link" onClick={signOut}>
              {t('signOut')}
            </button>
          ) : null}
        </nav>
      </header>
      <main className="container">
        {!token ? (
          <AuthPage onSignedIn={signIn} />
        ) : !status ? (
          <p>{t('loading')}</p>
        ) : !active ? (
          <OnboardingPage status={status} onChange={refreshStatus} />
        ) : (
          <>
            {!status.custodyReady ? <div className="banner">{t('custodyPending')}</div> : null}
            {tab === 'markets' ? (
              <MarketsPage onOrdered={() => setTab('portfolio')} />
            ) : (
              <PortfolioPage depositReference={status.depositReference} />
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <a href={tenant.branding.legalDocuments.termsUrl}>{t('consent_TERMS')}</a>
        <span>{tenant.branding.supportEmail}</span>
      </footer>
    </AppContext.Provider>
  );
}

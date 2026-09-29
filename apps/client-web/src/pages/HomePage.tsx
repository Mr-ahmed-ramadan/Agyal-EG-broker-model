import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, fill, money, nominal } from '../lib/format';

interface Holding {
  isin: string;
  nameEn: string;
  nameAr: string;
  type: string;
  maturityDate: string;
  daysToMaturity: number;
  nominal: string;
  cost: string;
}

interface Payment {
  isin: string;
  type: 'COUPON' | 'REDEMPTION';
  paymentDate: string;
  expectedNet: string;
}

interface Highlight {
  kind: 'FUND_ACCOUNT' | 'NEXT_PAYMENT' | 'MATURING' | 'IDLE_CASH';
  [k: string]: unknown;
}

interface News {
  id: string;
  tenantId: string | null;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  publishedAt: string;
}

export interface HomeView {
  clientStatus: string;
  depositReference: string;
  cash: { available: string };
  totals: { invested: string; faceValue: string; incomeReceivedNet: string; taxWithheld: string };
  holdings: Holding[];
  allocation: { type: string; cost: string; share: string }[];
  upcoming: Payment[];
  maturingSoon: { isin: string; maturityDate: string; days: number; nominal: string }[];
  highlights: Highlight[];
  news: News[];
}

/** The client's landing page: where they stand, what's coming, and news. */
export function HomePage({ onExplore }: { onExplore: () => void }) {
  const { t, locale, tenant } = useApp();
  const [home, setHome] = useState<HomeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => api<HomeView>('GET', '/home').then(setHome).catch((e) => setError((e as Error).message));
    load();
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!home) return <p>{t('loading')}</p>;

  const names = Object.fromEntries(home.holdings.map((h) => [h.isin, locale === 'ar' ? h.nameAr : h.nameEn]));
  const name = (isin: unknown) => names[String(isin)] ?? String(isin);
  const inReview = home.clientStatus === 'PENDING_APPROVAL' || home.clientStatus === 'NEEDS_INFO';

  const highlight = (h: Highlight) => {
    switch (h.kind) {
      case 'FUND_ACCOUNT':
        return fill(t('hl_FUND_ACCOUNT'), { reference: String(h.reference ?? '') });
      case 'NEXT_PAYMENT':
        return fill(t('hl_NEXT_PAYMENT'), {
          type: t(`inc_${h.type}`),
          amount: money(String(h.expectedNet), locale),
          date: date(String(h.paymentDate), locale),
          name: name(h.isin),
        });
      case 'MATURING':
        return fill(t('hl_MATURING'), { name: name(h.isin), days: Number(h.days), nominal: nominal(String(h.nominal), locale) });
      case 'IDLE_CASH':
        return fill(t('hl_IDLE_CASH'), { amount: money(String(h.amount), locale) });
    }
  };

  return (
    <div className="grid">
      <section className="welcome-banner">
        <h2>{fill(t('welcomeTo'), { broker: tenant.branding.displayName[locale] })}</h2>
        <p>{t('homeIntro')}</p>
      </section>
      <section className="card">
        {inReview ? (
          <div className="banner">
            <strong>{t('applicationReceived')}</strong>
            <p>{t('applicationReceivedHelp')}</p>
          </div>
        ) : null}
        <div className="stats">
          <div>
            <small>{t('portfolioValue')}</small>
            <strong>{money(home.totals.invested, locale)}</strong>
          </div>
          <div>
            <small>{t('cashAvailable')}</small>
            <strong>{money(home.cash.available, locale)}</strong>
          </div>
          <div>
            <small>{t('faceValueHeld')}</small>
            <strong>{nominal(home.totals.faceValue, locale)}</strong>
          </div>
          <div>
            <small>{t('incomeToDate')}</small>
            <strong>{money(home.totals.incomeReceivedNet, locale)}</strong>
          </div>
        </div>
        {home.allocation.length ? (
          <>
            <h3>{t('allocation')}</h3>
            <div className="alloc-bar" aria-hidden>
              {home.allocation.map((a) => (
                <span key={a.type} className={`seg seg-${a.type}`} style={{ width: `${Number(a.share) * 100}%` }} />
              ))}
            </div>
            <ul className="legend">
              {home.allocation.map((a) => (
                <li key={a.type}>
                  <span className={`dot seg-${a.type}`} /> {t(`type_${a.type}`)} · {Math.round(Number(a.share) * 100)}%
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {home.highlights.length ? (
          <>
            <h3>{t('highlights')}</h3>
            <ul className="highlights">
              {home.highlights.map((h, k) => (
                <li key={k} className={`hl hl-${h.kind}`}>
                  {highlight(h)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <button className="primary" onClick={onExplore}>
          {t('exploreRates')}
        </button>
      </section>

      <section className="card">
        <h2>{t('upcomingPayments')}</h2>
        {home.upcoming.length === 0 ? <p className="muted">{t('nothingYet')}</p> : null}
        <ul className="list">
          {home.upcoming.map((u, k) => (
            <li key={k} className="row static">
              <span>
                <strong>{name(u.isin)}</strong>
                <span className="meta muted">
                  <span>{t(`inc_${u.type}`)}</span>
                  <span>{date(u.paymentDate, locale)}</span>
                </span>
              </span>
              <span>{money(u.expectedNet, locale)}</span>
            </li>
          ))}
        </ul>
        {home.maturingSoon.length ? (
          <>
            <h3>{t('maturingSoon')}</h3>
            <ul className="list">
              {home.maturingSoon.map((m) => (
                <li key={m.isin} className="row static">
                  <span>
                    <strong>{name(m.isin)}</strong>
                    <span className="muted">{date(m.maturityDate, locale)}</span>
                  </span>
                  <span>{nominal(m.nominal, locale)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h2>{t('news')}</h2>
        {home.news.length === 0 ? <p className="muted">{t('nothingYet')}</p> : null}
        <ul className="news">
          {home.news.map((n) => (
            <li key={n.id}>
              <small className="muted">{date(n.publishedAt, locale)}</small>
              <strong>{locale === 'ar' ? n.titleAr : n.titleEn}</strong>
              <p>{locale === 'ar' ? n.bodyAr : n.bodyEn}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

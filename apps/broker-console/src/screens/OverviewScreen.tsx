import { useEffect, useState } from 'react';
import { api } from '../api';
import { egp, when } from '../useLoad';

interface Client { id: string; status: string }
interface Revenue { unswept: string; platformFee: string; custodyFee: string }
interface News { id: string; tenantId: string | null; titleEn: string; bodyEn: string; publishedAt: string }

/** Loads a GET endpoint but treats any failure (e.g. 403 for a narrower role) as "no data". */
function useMaybe<T>(path: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    api<T>('GET', path).then((d) => live && setData(d)).catch(() => live && setData(null));
    return () => { live = false; };
  }, [path]);
  return data;
}

/** Post-login landing page: a welcome, a few high-level numbers and the latest news. */
export function OverviewScreen({ onNavigate }: { onNavigate?: (k: string) => void }) {
  const [brand, setBrand] = useState<string>('your brokerage');
  useEffect(() => {
    api<{ branding: { displayName: { en: string } } }>('GET', '/tenant')
      .then((b) => setBrand(b.branding.displayName.en))
      .catch(() => {});
  }, []);

  const clients = useMaybe<Client[]>('/broker/clients');
  const revenue = useMaybe<Revenue>('/broker/revenue');
  const news = useMaybe<News[]>('/broker/news');

  const active = clients?.filter((c) => c.status === 'ACTIVE').length ?? 0;
  const pending = clients?.filter((c) => c.status === 'PENDING_APPROVAL').length ?? 0;

  const tiles: { label: string; value: string; sub?: string }[] = [];
  if (clients) tiles.push({ label: 'Clients', value: String(clients.length), sub: `${active} active · ${pending} awaiting review` });
  if (revenue) tiles.push({ label: 'Your revenue to date', value: egp(revenue.unswept), sub: 'markup earned, under your name' });
  if (revenue) tiles.push({ label: 'Agyal fee payable', value: egp(revenue.platformFee), sub: 'platform & custody settled separately' });

  return (
    <div className="overview">
      <div className="welcome">
        <h2>Welcome to {brand}</h2>
        <p className="muted">
          Your fixed-income desk at a glance. Onboard clients, price treasury bills, bonds and sukuk across your partner
          banks, and run settlement, coupons and the ledger — all under your own brand.
        </p>
      </div>

      {tiles.length > 0 ? (
        <div className="kpis">
          {tiles.map((k) => (
            <div key={k.label} className="kpi card">
              <span className="kpi-label">{k.label}</span>
              <strong>{k.value}</strong>
              {k.sub ? <span className="kpi-sub">{k.sub}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="quick">
        <button onClick={() => onNavigate?.('compliance')}>Review onboarding</button>
        <button onClick={() => onNavigate?.('deposits')}>Post a deposit</button>
        <button onClick={() => onNavigate?.('orders')}>See orders</button>
        <button onClick={() => onNavigate?.('news')}>Post client news</button>
      </div>

      <h3>Latest news</h3>
      {!news ? (
        <p className="muted">Loading…</p>
      ) : news.length === 0 ? (
        <p className="muted">No news yet. Publish an update from <button className="link inline" onClick={() => onNavigate?.('news')}>News for clients</button> — it shows on every client’s home page.</p>
      ) : (
        <ul className="newslist">
          {news.slice(0, 5).map((n) => (
            <li key={n.id} className="card">
              <div className="row">
                <strong>{n.titleEn}</strong>
                <span className="muted">{when(n.publishedAt)}{n.tenantId ? '' : ' · Agyal'}</span>
              </div>
              <p className="muted">{n.bodyEn}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

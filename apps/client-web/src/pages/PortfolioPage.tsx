import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, money, nominal } from '../lib/format';
import type { Instrument } from './MarketsPage';

interface Portfolio {
  cash: { available: string; reserved: string };
  positions: { isin: string; nominal: string }[];
}

interface Order {
  id: string;
  isin: string;
  quantity: string;
  ordStatus: string;
  createdAt: string;
  text: string | null;
  price: { totalCost: string; clientYield: string | null };
}

export function PortfolioPage({ depositReference }: { depositReference: string }) {
  const { t, locale } = useApp();
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [names, setNames] = useState<Record<string, Instrument>>({});

  useEffect(() => {
    const load = () => {
      api<Portfolio>('GET', '/portfolio').then(setPf);
      api<Order[]>('GET', '/orders').then(setOrders);
    };
    load();
    api<Instrument[]>('GET', '/instruments').then((list) =>
      setNames(Object.fromEntries(list.map((i) => [i.isin, i]))),
    );
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const name = (isin: string) => (names[isin] ? (locale === 'ar' ? names[isin].nameAr : names[isin].nameEn) : isin);

  if (!pf) return <p>{t('loading')}</p>;

  return (
    <div className="grid">
      <section className="card">
        <h2>{t('cash')}</h2>
        <dl>
          <dt>{t('available')}</dt>
          <dd className="total">{money(pf.cash.available, locale)}</dd>
          <dt>{t('reserved')}</dt>
          <dd>{money(pf.cash.reserved, locale)}</dd>
        </dl>
        <h3>{t('depositTitle')}</h3>
        <p className="muted">{t('depositHelp')}</p>
        <p className="reference" dir="ltr">{depositReference}</p>
      </section>
      <section className="card">
        <h2>{t('holdings')}</h2>
        {pf.positions.length === 0 ? <p className="muted">{t('noHoldings')}</p> : null}
        <ul className="list">
          {pf.positions.map((p) => (
            <li key={p.isin} className="row static">
              <strong>{name(p.isin)}</strong>
              <span>{nominal(p.nominal, locale)}</span>
            </li>
          ))}
        </ul>
        <h2>{t('orders')}</h2>
        {orders.length === 0 ? <p className="muted">{t('noOrders')}</p> : null}
        <ul className="list">
          {orders.map((o) => (
            <li key={o.id} className="row static">
              <span>
                <strong>{name(o.isin)}</strong>
                <span className="meta muted">
                  <span>{date(o.createdAt, locale)}</span>
                  <span>{nominal(o.quantity, locale)}</span>
                </span>
              </span>
              <span>
                <span className={`pill status-${o.ordStatus}`}>{t(`ord_${o.ordStatus}`)}</span>
                <span className="muted">{money(o.price.totalCost, locale)}</span>
                {o.text ? <small className="muted">{o.text}</small> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

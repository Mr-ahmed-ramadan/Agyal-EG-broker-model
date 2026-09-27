import { useEffect, useState } from 'react';
import { TradePanel } from '../components/TradePanel';
import { WithdrawPanel } from '../components/WithdrawPanel';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, money, nominal } from '../lib/format';
import type { Instrument } from './MarketsPage';

interface Portfolio {
  cash: { available: string; reserved: string };
  positions: { isin: string; nominal: string; reservedForSale: string }[];
}

interface CashSummary {
  available: string;
  reserved: string;
  pendingWithdrawal: string;
  unsettledSaleProceeds: string;
  withdrawable: string;
}

interface Withdrawal {
  id: string;
  amount: string;
  status: 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  requestedAt: string;
  iban: string;
}

interface Order {
  id: string;
  side: 'BUY' | 'SELL';
  isin: string;
  quantity: string;
  ordStatus: string;
  createdAt: string;
  text: string | null;
  price: { netAmount: string; clientYield: string | null };
}

export function PortfolioPage({ depositReference }: { depositReference: string }) {
  const { t, locale } = useApp();
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [names, setNames] = useState<Record<string, Instrument>>({});
  const [selling, setSelling] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [cash, setCash] = useState<CashSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const load = () => {
      api<Portfolio>('GET', '/portfolio').then(setPf);
      api<Order[]>('GET', '/orders').then(setOrders);
      api<CashSummary>('GET', '/cash').then(setCash);
      api<Withdrawal[]>('GET', '/withdrawals').then(setWithdrawals);
    };
    load();
    api<Instrument[]>('GET', '/instruments').then((list) =>
      setNames(Object.fromEntries(list.map((i) => [i.isin, i]))),
    );
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const name = (isin: string) => (names[isin] ? (locale === 'ar' ? names[isin].nameAr : names[isin].nameEn) : isin);

  if (!pf) return <p>{t('loading')}</p>;
  const sellPosition = selling ? pf.positions.find((p) => p.isin === selling) : undefined;

  return (
    <div className="grid">
      <section className="card">
        <h2>{t('cash')}</h2>
        <dl>
          <dt>{t('available')}</dt>
          <dd className="total">{money(pf.cash.available, locale)}</dd>
          <dt>{t('reserved')}</dt>
          <dd>{money(pf.cash.reserved, locale)}</dd>
          {cash && Number(cash.pendingWithdrawal) > 0 ? (
            <>
              <dt>{t('pendingWithdrawal')}</dt>
              <dd>{money(cash.pendingWithdrawal, locale)}</dd>
            </>
          ) : null}
          {cash ? (
            <>
              <dt>{t('withdrawable')}</dt>
              <dd>{money(cash.withdrawable, locale)}</dd>
            </>
          ) : null}
        </dl>
        {cash && Number(cash.unsettledSaleProceeds) > 0 ? <p className="muted">{t('unsettledHelp')}</p> : null}
        {cash && Number(cash.withdrawable) > 0 ? (
          <button className="secondary" onClick={() => setWithdrawing(true)}>
            {t('withdraw')}
          </button>
        ) : null}
        {withdrawals.length ? (
          <>
            <h3>{t('withdrawals')}</h3>
            <ul className="list">
              {withdrawals.map((w) => (
                <li key={w.id} className="row static">
                  <span className="meta muted">
                    <span>{date(w.requestedAt, locale)}</span>
                    <span dir="ltr">{w.iban}</span>
                  </span>
                  <span>
                    <span className={`pill wd-${w.status}`}>{t(`wd_${w.status}`)}</span>
                    <span>{money(w.amount, locale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h3>{t('depositTitle')}</h3>
        <p className="muted">{t('depositHelp')}</p>
        <p className="reference" dir="ltr">{depositReference}</p>
      </section>
      <section className="card">
        <h2>{t('holdings')}</h2>
        {pf.positions.length === 0 ? <p className="muted">{t('noHoldings')}</p> : null}
        <ul className="list">
          {pf.positions.map((p) => {
            const free = Number(p.nominal) - Number(p.reservedForSale);
            return (
              <li key={p.isin} className="row static">
                <span>
                  <strong>{name(p.isin)}</strong>
                  <span className="meta muted">
                    <span>{nominal(p.nominal, locale)}</span>
                    {Number(p.reservedForSale) > 0 ? (
                      <span>
                        {nominal(p.reservedForSale, locale)} {t('reservedForSale')}
                      </span>
                    ) : null}
                  </span>
                </span>
                {free > 0 && names[p.isin] ? (
                  <button className="secondary" onClick={() => setSelling(p.isin)}>
                    {t('sell')}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <h2>{t('orders')}</h2>
        {orders.length === 0 ? <p className="muted">{t('noOrders')}</p> : null}
        <ul className="list">
          {orders.map((o) => (
            <li key={o.id} className="row static">
              <span>
                <strong>
                  <span className={`pill side-${o.side}`}>{t(`side_${o.side}`)}</span>
                  {name(o.isin)}
                </strong>
                <span className="meta muted">
                  <span>{date(o.createdAt, locale)}</span>
                  <span>{nominal(o.quantity, locale)}</span>
                </span>
              </span>
              <span>
                <span className={`pill status-${o.ordStatus}`}>{t(`ord_${o.ordStatus}`)}</span>
                <span className="muted">{money(o.price.netAmount, locale)}</span>
                {o.text ? <small className="muted">{o.text}</small> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {withdrawing && cash ? (
        <WithdrawPanel
          withdrawable={cash.withdrawable}
          onClose={() => setWithdrawing(false)}
          onDone={() => setReload((n) => n + 1)}
        />
      ) : null}
      {sellPosition && names[sellPosition.isin] ? (
        <TradePanel
          key={sellPosition.isin}
          side="SELL"
          instrument={names[sellPosition.isin]}
          maxQuantity={String(Number(sellPosition.nominal) - Number(sellPosition.reservedForSale))}
          onClose={() => setSelling(null)}
          onOrdered={() => {
            setSelling(null);
            setReload((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

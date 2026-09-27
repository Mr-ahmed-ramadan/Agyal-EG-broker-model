import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, money, nominal, percent, price } from '../lib/format';

export interface Instrument {
  isin: string;
  type: string;
  nameEn: string;
  nameAr: string;
  couponRate: string | null;
  maturityDate: string;
  minQty: string;
  qtyIncrement: string;
}

interface ClientQuote {
  quoteId: string;
  validUntil: string;
  clientCleanPx: string;
  clientYield: string;
  principal: string;
  accruedInterest: string;
  commission: string;
  totalCost: string;
}

interface Rfq {
  id: string;
  settlDate: string;
  quotes: ClientQuote[];
}

export function MarketsPage({ onOrdered }: { onOrdered: () => void }) {
  const { t, locale } = useApp();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selected, setSelected] = useState<Instrument | null>(null);

  useEffect(() => {
    api<Instrument[]>('GET', '/instruments').then(setInstruments);
  }, []);

  return (
    <div className="grid">
      <section className="card">
        <h2>{t('markets')}</h2>
        <ul className="list">
          {instruments.map((i) => (
            <li key={i.isin}>
              <button className={`row ${selected?.isin === i.isin ? 'on' : ''}`} onClick={() => setSelected(i)}>
                <span>
                  <span className="pill">{t(`type_${i.type}`)}</span>
                  <strong>{locale === 'ar' ? i.nameAr : i.nameEn}</strong>
                </span>
                <span className="meta muted">
                  <span>
                    {t('matures')} {date(i.maturityDate, locale)}
                  </span>
                  {i.couponRate ? (
                    <span>
                      {t('coupon')} {percent(i.couponRate, locale)}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {selected ? <BuyPanel key={selected.isin} instrument={selected} onOrdered={onOrdered} /> : null}
    </div>
  );
}

function BuyPanel({ instrument, onOrdered }: { instrument: Instrument; onOrdered: () => void }) {
  const { t, locale } = useApp();
  const [quantity, setQuantity] = useState(String(Number(instrument.minQty)));
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const poll = useRef<number>();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    // On phones the panel sits below the instrument list; bring it into view.
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll.current);
    };
  }, []);

  async function requestPrice() {
    setError(null);
    setRfq(null);
    setWaiting(true);
    window.clearInterval(poll.current);
    try {
      const { id } = await api('POST', '/rfq', { isin: instrument.isin, quantity });
      const started = Date.now();
      poll.current = window.setInterval(async () => {
        const r = await api<Rfq>('GET', `/rfq/${id}`);
        setRfq(r);
        if (Date.now() - started > 15_000) {
          window.clearInterval(poll.current);
          setWaiting(false);
        } else if (r.quotes.length > 0) {
          setWaiting(false);
        }
      }, 1000);
    } catch (err) {
      setWaiting(false);
      setError((err as Error).message);
    }
  }

  async function buy(quoteId: string) {
    setError(null);
    try {
      await api('POST', '/orders', { quoteId });
      window.clearInterval(poll.current);
      alert(t('orderPlaced'));
      onOrdered();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const live = (rfq?.quotes ?? []).filter((q) => new Date(q.validUntil).getTime() > now);
  const [best, ...others] = live;

  return (
    <section className="card" ref={panel}>
      <h2>{locale === 'ar' ? instrument.nameAr : instrument.nameEn}</h2>
      <p className="muted" dir="ltr">{instrument.isin}</p>
      <label>
        {t('amount')}
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          dir="ltr"
        />
        <small>
          {t('minimum')} {nominal(instrument.minQty, locale)}
        </small>
      </label>
      <button className="primary" onClick={requestPrice} disabled={waiting}>
        {t('getPrice')}
      </button>
      {waiting ? <p className="muted">{t('waitingForBanks')}</p> : null}
      {rfq && !waiting && live.length === 0 ? <p className="muted">{t('noQuotes')}</p> : null}
      {best ? (
        <div className="quote">
          <div className="yield">
            <span>{t('yourYield')}</span>
            <strong>{percent(best.clientYield, locale)}</strong>
          </div>
          <dl>
            <dt>{t('priceLabel')}</dt>
            <dd>{price(best.clientCleanPx, locale)}</dd>
            <dt>{t('principal')}</dt>
            <dd>{money(best.principal, locale)}</dd>
            <dt>{t('accrued')}</dt>
            <dd>{money(best.accruedInterest, locale)}</dd>
            <dt>{t('commission')}</dt>
            <dd>{money(best.commission, locale)}</dd>
            <dt className="total">{t('total')}</dt>
            <dd className="total">{money(best.totalCost, locale)}</dd>
            <dt>{t('settlement')}</dt>
            <dd>{date(rfq!.settlDate, locale)}</dd>
          </dl>
          <p className="muted">
            {t('validFor')} {Math.max(0, Math.round((new Date(best.validUntil).getTime() - now) / 1000))}
            {t('seconds')}
          </p>
          <button className="primary" onClick={() => buy(best.quoteId)}>
            {t('buy')}
          </button>
          {others.length ? (
            <p className="muted">
              {t('otherQuotes')}: {others.map((q) => percent(q.clientYield, locale)).join(locale === 'ar' ? '، ' : ', ')}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

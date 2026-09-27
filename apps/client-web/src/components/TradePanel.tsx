import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, money, nominal, percent, price } from '../lib/format';
import type { Instrument } from '../pages/RatesPage';
import { ProjectionDetail, ProjectionSummary, type Projection } from './ProjectionView';

interface ClientQuote {
  quoteId: string;
  validUntil: string;
  clientCleanPx: string;
  clientYield: string;
  principal: string;
  accruedInterest: string;
  commission: string;
  netAmount: string;
  /** Buying: this quote held to maturity, after tax */
  holdToMaturity: Projection | null;
}

interface Rfq {
  id: string;
  settlDate: string;
  quotes: ClientQuote[];
}

/**
 * Request live prices from the broker's partner banks and accept the best
 * one. Used for buying (from Invest) and selling before maturity (from Portfolio).
 */
export function TradePanel({
  side,
  instrument,
  maxQuantity,
  initialQuantity,
  onOrdered,
  onClose,
}: {
  side: 'BUY' | 'SELL';
  instrument: Instrument;
  /** Selling: nominal the client can sell */
  maxQuantity?: string;
  /** Buying: nominal to start with (e.g. from "if you invest today") */
  initialQuantity?: string;
  onOrdered: () => void;
  onClose?: () => void;
}) {
  const { t, locale } = useApp();
  const [quantity, setQuantity] = useState(
    String(Number(side === 'SELL' && maxQuantity ? maxQuantity : initialQuantity ?? instrument.minQty)),
  );
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const poll = useRef<number>();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    // On phones the panel sits below the list; bring it into view.
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
      const { id } = await api('POST', '/rfq', { side, isin: instrument.isin, quantity });
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

  async function accept(quoteId: string) {
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
      <div className="row static plain">
        <h2>{side === 'SELL' ? t('sellTitle') : locale === 'ar' ? instrument.nameAr : instrument.nameEn}</h2>
        {onClose ? (
          <button className="link" onClick={onClose}>
            {t('close')}
          </button>
        ) : null}
      </div>
      {side === 'SELL' ? (
        <>
          <p>
            <strong>{locale === 'ar' ? instrument.nameAr : instrument.nameEn}</strong>
          </p>
          <p className="muted">{t('sellHelp')}</p>
        </>
      ) : null}
      <p className="muted" dir="ltr">
        {instrument.isin}
      </p>
      <label>
        {t('amount')}
        <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" dir="ltr" />
        <small>
          {side === 'SELL' && maxQuantity
            ? `${t('maxToSell')} ${nominal(maxQuantity, locale)}`
            : `${t('minimum')} ${nominal(instrument.minQty, locale)}`}
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
            <span>{side === 'SELL' ? t('youReceive') : t('yourYield')}</span>
            <strong>{side === 'SELL' ? money(best.netAmount, locale) : percent(best.clientYield, locale)}</strong>
          </div>
          <dl>
            {side === 'SELL' ? (
              <>
                <dt>{t('yourYield')}</dt>
                <dd>{percent(best.clientYield, locale)}</dd>
              </>
            ) : null}
            <dt>{t('priceLabel')}</dt>
            <dd>{price(best.clientCleanPx, locale)}</dd>
            <dt>{t('principal')}</dt>
            <dd>{money(best.principal, locale)}</dd>
            <dt>{t('accrued')}</dt>
            <dd>{money(best.accruedInterest, locale)}</dd>
            <dt>{t('commission')}</dt>
            <dd>
              {side === 'SELL' ? '−' : ''}
              {money(best.commission, locale)}
            </dd>
            <dt className="total">{side === 'SELL' ? t('youReceive') : t('total')}</dt>
            <dd className="total">{money(best.netAmount, locale)}</dd>
            <dt>{t('settlement')}</dt>
            <dd>{date(rfq!.settlDate, locale)}</dd>
          </dl>
          {best.holdToMaturity ? (
            <details className="htm" open>
              <summary>{t('holdToMaturityTitle')}</summary>
              <ProjectionSummary p={best.holdToMaturity} />
              <ProjectionDetail p={best.holdToMaturity} />
            </details>
          ) : null}
          <p className="muted">
            {t('validFor')} {Math.max(0, Math.round((new Date(best.validUntil).getTime() - now) / 1000))}
            {t('seconds')}
          </p>
          <button className="primary" onClick={() => accept(best.quoteId)}>
            {side === 'SELL' ? t('sell') : t('buy')}
          </button>
          {others.length ? (
            <p className="muted">
              {t('otherQuotes')}:{' '}
              {others
                .map((q) => (side === 'SELL' ? money(q.netAmount, locale) : percent(q.clientYield, locale)))
                .join(locale === 'ar' ? '، ' : ', ')}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

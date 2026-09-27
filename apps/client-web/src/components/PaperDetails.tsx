import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, fill, money, percent } from '../lib/format';
import type { Instrument } from '../pages/RatesPage';
import { ProjectionDetail, ProjectionSummary, type Projection } from './ProjectionView';
import { TradePanel } from './TradePanel';

interface IndicativeProjection extends Projection {
  commissionRule: { bps: number; min: string };
  taxRate: number;
}

/**
 * A paper explained simply, with "if you invest today" at the indicative
 * rate: what you pay, every payment until maturity after tax, net profit.
 */
export function PaperDetails({
  instrument,
  canBuy,
  onClose,
  onOrdered,
}: {
  instrument: Instrument;
  canBuy: boolean;
  onClose: () => void;
  onOrdered: () => void;
}) {
  const { t, locale, tenant } = useApp();
  const [amount, setAmount] = useState('100000');
  const [proj, setProj] = useState<IndicativeProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (!instrument.indicativeYield) return;
    const timer = window.setTimeout(() => {
      if (!Number(amount)) return;
      api<IndicativeProjection>('GET', `/instruments/${instrument.isin}/projection?amount=${amount}`)
        .then((p) => {
          setProj(p);
          setError(null);
        })
        .catch((e) => {
          setProj(null);
          setError((e as Error).message);
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [amount, instrument]);

  const name = locale === 'ar' ? instrument.nameAr : instrument.nameEn;

  if (buying) {
    return (
      <TradePanel
        side="BUY"
        instrument={instrument}
        initialQuantity={proj?.nominal}
        onClose={() => setBuying(false)}
        onOrdered={onOrdered}
      />
    );
  }

  return (
    <section className="card" ref={panel}>
      <div className="row static plain">
        <h2>{name}</h2>
        <button className="link" onClick={onClose}>
          {t('close')}
        </button>
      </div>
      {instrument.indicativeYield ? (
        <p className="big-yield">
          <strong>{percent(instrument.indicativeYield, locale)}</strong> <span className="muted">{t('yieldPa')} · {t('indicative')}</span>
        </p>
      ) : null}

      <h3>{t('whatIsThis')}</h3>
      <p>{t(`explain_${instrument.type}`)}</p>

      <h3>{t('keyFacts')}</h3>
      <dl>
        <dt>{t('issuer')}</dt>
        <dd>{instrument.issuer}</dd>
        <dt>{t('maturityDate')}</dt>
        <dd>{date(instrument.maturityDate, locale)}</dd>
        {instrument.couponRate ? (
          <>
            <dt>{t('couponRate')}</dt>
            <dd>
              {percent(instrument.couponRate, locale)}
              {instrument.couponFreq ? ` · ${t('paidEvery')} ${t(`freq_${instrument.couponFreq}`)}` : ''}
            </dd>
          </>
        ) : null}
        <dt>{t('custody')}</dt>
        <dd>{t(`dep_${instrument.depository}`)}</dd>
        <dt>ISIN</dt>
        <dd dir="ltr">{instrument.isin}</dd>
      </dl>

      {instrument.indicativeYield ? (
        <>
          <h3>{t('ifYouInvest')}</h3>
          <label>
            {t('investAmount')}
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" dir="ltr" />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {proj ? (
            <>
              <ProjectionSummary p={proj} />
              <ProjectionDetail p={proj} />
              <h3>{t('feesTitle')}</h3>
              <ul className="fees">
                <li>{fill(t('feesYield'), { broker: tenant.branding.displayName[locale] })}</li>
                <li>
                  {fill(t('feesCommission'), {
                    pct: percent(proj.commissionRule.bps / 10_000, locale),
                    min: money(proj.commissionRule.min, locale),
                  })}
                </li>
                <li>{fill(t('feesTax'), { pct: percent(proj.taxRate, locale) })}</li>
                <li>{t('feesNone')}</li>
              </ul>
              <p className="muted small">{t('disclaimer')}</p>
            </>
          ) : null}
        </>
      ) : null}

      {canBuy ? (
        <button className="primary" onClick={() => setBuying(true)}>
          {t('buyThis')}
        </button>
      ) : (
        <p className="banner">{t('buyLocked')}</p>
      )}
    </section>
  );
}

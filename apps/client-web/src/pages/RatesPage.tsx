import { useEffect, useState } from 'react';
import { PaperDetails } from '../components/PaperDetails';
import { useApp } from '../context';
import { api } from '../lib/api';
import { daysUntil, percent, termLabel } from '../lib/format';

export interface Instrument {
  isin: string;
  type: string;
  issuer: string;
  nameEn: string;
  nameAr: string;
  couponRate: string | null;
  couponFreq: number | null;
  maturityDate: string;
  depository: string;
  minQty: string;
  qtyIncrement: string;
  /** Client yield after the broker's margin (indicative), null if none yet */
  indicativeYield: string | null;
  indicativeAsOf: string | null;
  taxRate: number;
}

const TYPES = ['TREASURY_BILL', 'TREASURY_BOND', 'SUKUK', 'CORPORATE_BOND'];

/** Today's indicative rates; tap a paper for the explainer and "if you invest today". */
export function RatesPage({ canBuy, onOrdered }: { canBuy: boolean; onOrdered: () => void }) {
  const { t, locale } = useApp();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    api<Instrument[]>('GET', '/instruments').then(setInstruments);
  }, []);

  const types = TYPES.filter((ty) => instruments.some((i) => i.type === ty));
  const shown = instruments
    .filter((i) => filter === 'ALL' || i.type === filter)
    .sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.maturityDate.localeCompare(b.maturityDate));

  return (
    <div className="grid">
      <section className="card">
        <h2>{t('ratesTitle')}</h2>
        <p className="muted">{t('ratesHelp')}</p>
        <div className="chips" role="tablist">
          {['ALL', ...types].map((ty) => (
            <button key={ty} className={`chip ${filter === ty ? 'on' : ''}`} onClick={() => setFilter(ty)}>
              {ty === 'ALL' ? t('all') : t(`type_${ty}`)}
            </button>
          ))}
        </div>
        <ul className="list">
          {shown.map((i) => (
            <li key={i.isin}>
              <button className={`row rate ${selected?.isin === i.isin ? 'on' : ''}`} onClick={() => setSelected(i)}>
                <span>
                  <span className="pill">{t(`type_${i.type}`)}</span>
                  <strong>{locale === 'ar' ? i.nameAr : i.nameEn}</strong>
                  <span className="muted">
                    {t('term')}: {termLabel(daysUntil(i.maturityDate), t, locale)}
                  </span>
                </span>
                <span className="rate-figure">
                  {i.indicativeYield ? (
                    <>
                      <strong>{percent(i.indicativeYield, locale)}</strong>
                      <small>{t('yieldPa')}</small>
                    </>
                  ) : (
                    <small>{t('noRate')}</small>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <details className="faq">
          <summary>{t('faqWhereTitle')}</summary>
          <p>{t('faqWhereBody')}</p>
        </details>
        <details className="faq">
          <summary>{t('faqUniverseTitle')}</summary>
          <p>{t('faqUniverseBody')}</p>
        </details>
      </section>
      {selected ? (
        <PaperDetails
          key={selected.isin}
          instrument={selected}
          canBuy={canBuy}
          onClose={() => setSelected(null)}
          onOrdered={onOrdered}
        />
      ) : null}
    </div>
  );
}

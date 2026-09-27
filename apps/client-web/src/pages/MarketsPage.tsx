import { useEffect, useState } from 'react';
import { TradePanel } from '../components/TradePanel';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, percent } from '../lib/format';

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
      {selected ? (
        <TradePanel key={selected.isin} side="BUY" instrument={selected} onOrdered={onOrdered} />
      ) : null}
    </div>
  );
}

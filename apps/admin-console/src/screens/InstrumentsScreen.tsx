import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad, when } from '../useLoad';

interface Instrument {
  id: string;
  isin: string;
  type: string;
  issuer: string;
  nameEn: string;
  couponRate: string | null;
  couponFreq: number | null;
  maturityDate: string;
  depository: string;
  minQty: string;
}

interface Rate {
  isin: string;
  offerYield: string | null;
  source: string;
  asOf: string;
}

const TYPES = ['TREASURY_BILL', 'TREASURY_BOND', 'CORPORATE_BOND', 'SUKUK'];

/** Bank offer yield shown to clients (less each broker's markup) until a live quote refreshes it. */
function IndicativeCell({ isin, rate, onSaved }: { isin: string; rate?: Rate; onSaved: () => void }) {
  const [value, setValue] = useState(rate?.offerYield ? (Number(rate.offerYield) * 100).toFixed(2) : '');
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setErr(null);
    try {
      await api('POST', `/admin/instruments/${isin}/indicative`, { offerYield: Number(value) / 100 });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <span className="inline">
      <input value={value} onChange={(e) => setValue(e.target.value)} size={6} inputMode="decimal" aria-label="Offer yield %" />%
      <button className="link" onClick={save}>Save</button>
      {rate ? <small className="muted">{rate.source === 'BANK_QUOTE' ? 'from bank quote' : rate.source.toLowerCase()} · {when(rate.asOf)}</small> : null}
      {err ? <small className="error">{err}</small> : null}
    </span>
  );
}

export function InstrumentsScreen() {
  const { data, error, reload } = useLoad<Instrument[]>('/admin/instruments');
  const rates = useLoad<Rate[]>('/admin/indicative-rates');
  const rateOf = (isin: string) => rates.data?.find((r) => r.isin === isin);
  const [f, setF] = useState({
    isin: '', type: 'TREASURY_BOND', issuer: '', nameEn: '', nameAr: '', couponRate: '', couponFreq: '2',
    maturityDate: '', depository: 'MCDR', minQty: '1000', qtyIncrement: '1000',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const isBill = f.type === 'TREASURY_BILL';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api('POST', '/admin/instruments', {
        isin: f.isin.toUpperCase(),
        type: f.type,
        issuer: f.issuer,
        nameEn: f.nameEn,
        nameAr: f.nameAr,
        couponRate: isBill ? undefined : f.couponRate,
        couponFreq: isBill ? undefined : Number(f.couponFreq),
        maturityDate: f.maturityDate,
        depository: f.depository,
        minQty: f.minQty,
        qtyIncrement: f.qtyIncrement,
      });
      setF({ ...f, isin: '', nameEn: '', nameAr: '' });
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <section>
      <h2>Instruments</h2>
      <p className="muted">
        Master data shared by all brokers. Each broker chooses which instrument types it offers. The indicative
        yield is the banks' offer yield clients see (less the broker's markup) before asking for a live price; live
        bank quotes update it automatically.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead><tr><th>ISIN</th><th>Type</th><th>Name</th><th>Issuer</th><th>Coupon</th><th>Maturity</th><th>Depository</th><th>Minimum</th><th>Indicative offer yield</th></tr></thead>
        <tbody>
          {data?.map((i) => (
            <tr key={i.id}>
              <td className="mono">{i.isin}</td>
              <td>{i.type.replace('_', ' ').toLowerCase()}</td>
              <td>{i.nameEn}</td>
              <td>{i.issuer}</td>
              <td>{i.couponRate ? `${(Number(i.couponRate) * 100).toFixed(2)}% × ${i.couponFreq}/yr` : '-'}</td>
              <td>{i.maturityDate.slice(0, 10)}</td>
              <td>{i.depository}</td>
              <td>{Number(i.minQty).toLocaleString('en')}</td>
              <td>
                {rates.data ? <IndicativeCell key={rateOf(i.isin)?.asOf ?? i.isin} isin={i.isin} rate={rateOf(i.isin)} onSaved={rates.reload} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Add instrument</h3>
      <form className="card fields" onSubmit={submit}>
        <label>ISIN<input value={f.isin} onChange={set('isin')} required maxLength={12} /></label>
        <label>
          Type
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, depository: e.target.value === 'TREASURY_BILL' ? 'CBE' : 'MCDR', minQty: e.target.value === 'TREASURY_BILL' ? '25000' : '1000', qtyIncrement: e.target.value === 'TREASURY_BILL' ? '25000' : '1000' })}>
            {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ').toLowerCase()}</option>)}
          </select>
        </label>
        <label>Issuer<input value={f.issuer} onChange={set('issuer')} required /></label>
        <label>Name (English)<input value={f.nameEn} onChange={set('nameEn')} required /></label>
        <label>Name (Arabic)<input value={f.nameAr} onChange={set('nameAr')} required dir="rtl" /></label>
        {!isBill ? (
          <>
            <label>Coupon rate (fraction, e.g. 0.22)<input value={f.couponRate} onChange={set('couponRate')} required /></label>
            <label>
              Coupons per year
              <select value={f.couponFreq} onChange={set('couponFreq')}>
                {['1', '2', '4', '12'].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          </>
        ) : null}
        <label>Maturity date<input type="date" value={f.maturityDate} onChange={set('maturityDate')} required /></label>
        <label>
          Depository
          <select value={f.depository} onChange={set('depository')}>
            {['MCDR', 'CBE', 'BANK_INTERNAL'].map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>Minimum nominal<input value={f.minQty} onChange={set('minQty')} required /></label>
        <label>Increment<input value={f.qtyIncrement} onChange={set('qtyIncrement')} required /></label>
        <button className="primary">Add instrument</button>
        {formError ? <p className="error">{formError}</p> : null}
      </form>
    </section>
  );
}

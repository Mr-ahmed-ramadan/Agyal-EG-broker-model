import { useState } from 'react';
import { api } from '../api';
import { egp, useLoad } from '../useLoad';

interface PendingIncome {
  key: string;
  isin: string;
  name: string;
  type: 'COUPON' | 'REDEMPTION';
  paymentDate: string;
  holders: number;
  totalNominal: string;
  totalGross: string;
  totalTax: string;
  due: boolean;
  canConfirm: boolean;
}

interface Confirmed { id: string; isin: string; type: string; paymentDate: string; totalGross: string; reference: string; _count: { entitlements: number } }

const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC' });

export function IncomeScreen({ roles }: { roles: string[] }) {
  const pending = useLoad<PendingIncome[]>('/broker/income');
  const history = useLoad<Confirmed[]>('/broker/income/history');
  const canConfirm = roles.some((r) => r === 'BROKER_OPS' || r === 'BROKER_ADMIN');
  const reload = () => { pending.reload(); history.reload(); };
  return (
    <section>
      <h2>Coupons &amp; maturities</h2>
      <p className="muted">
        Payments on bonds and sukuk your clients hold, and T-bill and bond redemptions at maturity. When the custodian
        (or CBE for T-bills) pays, confirm receipt: clients are credited and matured holdings are closed.
      </p>
      {pending.error ? <p className="error">{pending.error}</p> : null}
      {pending.data?.length === 0 ? <p className="muted">No coupons or maturities due in the next 60 days.</p> : null}
      {pending.data?.length ? (
        <table>
          <thead>
            <tr><th>Pays</th><th>Instrument</th><th>Type</th><th className="num">Holders</th><th className="num">Nominal</th><th className="num">Gross</th><th className="num">Tax withheld</th><th>Custodian reference</th></tr>
          </thead>
          <tbody>
            {pending.data.map((e) => <Row key={e.key} e={e} canConfirm={canConfirm} onDone={reload} />)}
          </tbody>
        </table>
      ) : null}
      <h3>Confirmed</h3>
      <table>
        <thead><tr><th>Paid</th><th>ISIN</th><th>Type</th><th className="num">Clients</th><th className="num">Gross</th><th>Reference</th></tr></thead>
        <tbody>
          {history.data?.map((h) => (
            <tr key={h.id}><td>{day(h.paymentDate)}</td><td className="mono">{h.isin}</td><td>{h.type === 'COUPON' ? 'Coupon' : 'Redemption'}</td><td className="num">{h._count.entitlements}</td><td className="num">{egp(h.totalGross)}</td><td className="mono">{h.reference}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Row({ e, canConfirm, onDone }: { e: PendingIncome; canConfirm: boolean; onDone: () => void }) {
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setError(null);
    try {
      await api('POST', '/broker/income/confirm', { isin: e.isin, type: e.type, paymentDate: e.paymentDate.slice(0, 10), reference });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <tr>
      <td>{day(e.paymentDate)}{e.due ? <div className="warn">Due</div> : null}</td>
      <td>{e.name}<div className="mono muted">{e.isin}</div></td>
      <td>{e.type === 'COUPON' ? 'Coupon' : 'Redemption'}</td>
      <td className="num">{e.holders}</td>
      <td className="num">{Number(e.totalNominal).toLocaleString('en')}</td>
      <td className="num">{egp(e.totalGross)}</td>
      <td className="num">{egp(e.totalTax)}</td>
      <td>
        {canConfirm && e.canConfirm ? (
          <div className="inline">
            <input aria-label={`Reference for ${e.key}`} value={reference} onChange={(x) => setReference(x.target.value)} placeholder="Custodian payment ref" />
            <button className="primary" disabled={reference.length < 3} onClick={confirm}>Confirm received</button>
          </div>
        ) : (
          <span className="muted">{e.canConfirm ? '-' : 'Not due yet'}</span>
        )}
        {error ? <div className="error">{error}</div> : null}
      </td>
    </tr>
  );
}

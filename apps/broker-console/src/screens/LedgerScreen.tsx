import { useState } from 'react';
import { api } from '../api';
import { egp, useLoad } from '../useLoad';

interface Row { type: string; unit: string; clientId: string | null; bankId: string | null; rawSum: string }

export function LedgerScreen({ roles }: { roles: string[] }) {
  const { data, error, reload } = useLoad<Row[]>('/broker/ledger/trial-balance');
  const canSweep = roles.some((r) => r === 'BROKER_FINANCE' || r === 'BROKER_ADMIN');
  const totals = new Map<string, number>();
  data?.forEach((r) => totals.set(r.unit, (totals.get(r.unit) ?? 0) + Number(r.rawSum)));
  return (
    <section>
      {canSweep ? <RevenueSweep onDone={reload} /> : null}
      <h2>Trial balance</h2>
      <p className="muted">Debits positive, credits negative. Each currency and each ISIN must net to zero.</p>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead><tr><th>Account</th><th>Unit</th><th>Client</th><th>Bank</th><th className="num">Balance</th></tr></thead>
        <tbody>
          {data?.map((r, i) => (
            <tr key={i}>
              <td>{r.type}</td>
              <td className="mono">{r.unit}</td>
              <td className="mono">{r.clientId?.slice(0, 8) ?? '-'}</td>
              <td className="mono">{r.bankId?.slice(0, 8) ?? '-'}</td>
              <td className="num">{Number(r.rawSum).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[...totals].map(([unit, total]) => (
            <tr key={unit}>
              <td colSpan={4}>Net {unit}</td>
              <td className={`num ${Math.abs(total) < 0.005 ? 'ok' : 'error'}`}>{(Math.abs(total) < 0.005 ? 0 : total).toFixed(2)}</td>
            </tr>
          ))}
        </tfoot>
      </table>
    </section>
  );
}

/** Moves earned markup and commission out of the segregated client-money account. */
function RevenueSweep({ onDone }: { onDone: () => void }) {
  const { data, reload } = useLoad<{ unswept: string }>('/broker/revenue');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function sweep() {
    setError(null);
    try {
      await api('POST', '/broker/revenue/sweep', { amount: data!.unswept, bankReference: reference });
      setReference('');
      reload();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data) return null;
  return (
    <div className="card">
      <h3>Broker revenue in the client-money account: {egp(data.unswept)}</h3>
      <p className="muted">Markup and commission earned on trades. Transfer it to the broker&apos;s own account, then record it here.</p>
      <div className="inline">
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer reference" />
        <button className="primary" disabled={Number(data.unswept) <= 0 || reference.length < 3} onClick={sweep}>
          Record transfer of {egp(data.unswept)}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

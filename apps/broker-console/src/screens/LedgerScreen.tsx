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

type PayoutKind = 'BROKER_REVENUE' | 'PLATFORM_FEE' | 'CUSTODY_FEE';
interface Payables { unswept: string; platformFee: string; custodyFee: string }

const PAYOUTS: { kind: PayoutKind; field: keyof Payables; title: string; help: string }[] = [
  { kind: 'BROKER_REVENUE', field: 'unswept', title: 'Your revenue', help: "Your margin (and any commission). Transfer it to the broker's own account." },
  { kind: 'PLATFORM_FEE', field: 'platformFee', title: 'Agyal platform fee', help: 'Agyal’s margin on trades. Transfer it to Agyal (usually monthly, against Agyal’s invoice).' },
  { kind: 'CUSTODY_FEE', field: 'custodyFee', title: 'Custody & operations', help: 'Custody and operational costs. Transfer them to the custodian.' },
];

/**
 * Money in the segregated client-money account that isn't client money:
 * record each transfer out so the account holds exactly what clients own.
 */
function RevenueSweep({ onDone }: { onDone: () => void }) {
  const { data, reload } = useLoad<Payables>('/broker/revenue');
  const [refs, setRefs] = useState<Record<PayoutKind, string>>({ BROKER_REVENUE: '', PLATFORM_FEE: '', CUSTODY_FEE: '' });
  const [error, setError] = useState<string | null>(null);
  async function pay(kind: PayoutKind, amount: string) {
    setError(null);
    try {
      await api('POST', '/broker/revenue/sweep', { amount, bankReference: refs[kind], account: kind });
      setRefs({ ...refs, [kind]: '' });
      reload();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data) return null;
  return (
    <div className="card">
      <h3>Payouts from the client-money account</h3>
      {PAYOUTS.map((p) => (
        <div key={p.kind} className="payout">
          <strong>{p.title}: {egp(data[p.field])}</strong>
          <p className="muted">{p.help}</p>
          <div className="inline">
            <input value={refs[p.kind]} onChange={(e) => setRefs({ ...refs, [p.kind]: e.target.value })} placeholder="Transfer reference" />
            <button className="primary" disabled={Number(data[p.field]) <= 0 || refs[p.kind].length < 3} onClick={() => pay(p.kind, data[p.field])}>
              Record transfer of {egp(data[p.field])}
            </button>
          </div>
        </div>
      ))}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

import { useLoad } from '../useLoad';

interface Row { type: string; unit: string; clientId: string | null; bankId: string | null; rawSum: string }

export function LedgerScreen() {
  const { data, error } = useLoad<Row[]>('/broker/ledger/trial-balance');
  const totals = new Map<string, number>();
  data?.forEach((r) => totals.set(r.unit, (totals.get(r.unit) ?? 0) + Number(r.rawSum)));
  return (
    <section>
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

import { useLoad, egp } from '../useLoad';

interface Waterfall {
  marketYield: number;
  custody: number;
  brokerMargin: number;
  platformMargin: number;
  clientYield: number;
  taxRate: number;
  tax: number;
  netYield: number;
  depositRate: number;
  vsDeposit: number;
  belowDeposit: boolean;
}

interface View {
  effective: { commissionBps: number; commissionMin: string; showBreakdownToClients: boolean };
  example: { waterfall: Waterfall };
  papers: (Waterfall & { isin: string; nameEn: string; maturityDate: string })[];
  months: { month: string; trades: number; volume: string; brokerRevenue: string; platformFee: string; custodyFee: string }[];
}

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/** Read only: the economics this broker trades under, set by Agyal. */
export function EconomicsScreen() {
  const { data, error } = useLoad<View>('/broker/economics');
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading…</p>;
  const w = data.example.waterfall;
  return (
    <section>
      <h2>Economics</h2>
      <p className="muted">
        How your clients' return is built. These settings are agreed with Agyal; contact Agyal to change them.
        {data.effective.commissionBps ? ` Commission: ${(data.effective.commissionBps / 100).toFixed(2)}% (min ${egp(data.effective.commissionMin)}).` : ' No commission is charged.'}
        {data.effective.showBreakdownToClients ? ' Clients see the full breakdown.' : ' Clients see only yield, tax and net.'}
      </p>
      <div className="card">
        <table className="waterfall">
          <caption>Illustration · one-year treasury bond</caption>
          <tbody>
            <tr><td>Market yield</td><td>{pct(w.marketYield)}</td></tr>
            <tr><td>Custody & operations</td><td>−{pct(w.custody)}</td></tr>
            <tr><td>Your margin</td><td>−{pct(w.brokerMargin)}</td></tr>
            <tr><td>Agyal margin</td><td>−{pct(w.platformMargin)}</td></tr>
            <tr className="sub"><td>Client yield before tax</td><td>{pct(w.clientYield)}</td></tr>
            <tr><td>Tax ({(w.taxRate * 100).toFixed(0)}%)</td><td>−{pct(w.tax)}</td></tr>
            <tr className="sub"><td>Client net yield</td><td>{pct(w.netYield)}</td></tr>
            <tr><td>Bank deposit, same term</td><td>{pct(w.depositRate)}</td></tr>
            <tr className={w.belowDeposit ? 'bad' : 'good'}><td>Client vs deposit</td><td>{w.vsDeposit >= 0 ? '+' : '−'}{pct(Math.abs(w.vsDeposit))}</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Today's papers</h3>
      <table>
        <thead><tr><th>Paper</th><th>Market</th><th>Client before tax</th><th>Client net</th><th>Deposit</th><th>Difference</th></tr></thead>
        <tbody>
          {data.papers.map((p) => (
            <tr key={p.isin} className={p.belowDeposit ? 'warn' : ''}>
              <td>{p.nameEn}</td><td>{pct(p.marketYield)}</td><td>{pct(p.clientYield)}</td><td>{pct(p.netYield)}</td><td>{pct(p.depositRate)}</td>
              <td className={p.belowDeposit ? 'error' : 'ok'}>{p.vsDeposit >= 0 ? '+' : '−'}{pct(Math.abs(p.vsDeposit))}{p.belowDeposit ? ' · below deposit' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Results by month</h3>
      {data.months.length ? (
        <table>
          <thead><tr><th>Month</th><th>Trades</th><th>Volume</th><th>Your revenue</th><th>Agyal fee</th><th>Custody</th></tr></thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.month}><td>{m.month}</td><td>{m.trades}</td><td>{egp(m.volume)}</td><td><strong>{egp(m.brokerRevenue)}</strong></td><td>{egp(m.platformFee)}</td><td>{egp(m.custodyFee)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No trades yet.</p>
      )}
    </section>
  );
}

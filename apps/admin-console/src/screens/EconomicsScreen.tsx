import { useEffect, useState } from 'react';
import { api } from '../api';
import { egp, useLoad } from '../useLoad';

type PaperType = 'TREASURY_BILL' | 'TREASURY_BOND' | 'CORPORATE_BOND' | 'SUKUK';
type Tenor = 'UP_TO_3M' | 'UP_TO_6M' | 'UP_TO_1Y' | 'OVER_1Y';

interface Economics {
  custodyBps: number;
  brokerMarginBps: number;
  platformMarginBps: number;
  commissionBps: number;
  commissionMin: string;
  taxRates: Record<PaperType, number>;
  depositRates: Record<Tenor, number>;
  showBreakdownToClients: boolean;
  maxTotalDeductionBps: number;
}

interface BrokerRow {
  slug: string;
  name: string;
  kind: string;
  overrides: Partial<Economics>;
  effective: Economics;
  papersBelowDeposit: number;
}

interface RevenueRow {
  month: string;
  slug: string;
  name: string;
  volume: string;
  trades: number;
  brokerRevenue: string;
  platformFee: string;
  custodyFee: string;
}

const PAPERS: [PaperType, string][] = [
  ['TREASURY_BILL', 'T-bills'],
  ['TREASURY_BOND', 'Treasury bonds'],
  ['SUKUK', 'Sukuk'],
  ['CORPORATE_BOND', 'Corporate bonds'],
];
const TENORS: [Tenor, string][] = [
  ['UP_TO_3M', 'Up to 3 months'],
  ['UP_TO_6M', 'Up to 6 months'],
  ['UP_TO_1Y', 'Up to 1 year'],
  ['OVER_1Y', 'Over 1 year'],
];

const pct = (v: number, dp = 2) => `${(v * 100).toFixed(dp)}%`;
const bpsPct = (b: number) => (b / 100).toFixed(2);

/** One-year bond at 25.50% market yield, recalculated from the form. */
function Waterfall({ e, market = 0.255 }: { e: Economics; market?: number }) {
  const custody = e.custodyBps / 10_000;
  const broker = e.brokerMarginBps / 10_000;
  const platform = e.platformMarginBps / 10_000;
  const client = Math.max(0, market - custody - broker - platform);
  const tax = client * e.taxRates.TREASURY_BOND;
  const net = client - tax;
  const deposit = e.depositRates.UP_TO_1Y;
  const diff = net - deposit;
  return (
    <table className="waterfall">
      <caption>Illustration · one-year treasury bond</caption>
      <tbody>
        <tr><td>Market yield (auction or current valuation)</td><td>{pct(market)}</td></tr>
        <tr><td>Operational costs (custody)</td><td>−{pct(custody)}</td></tr>
        <tr><td>Margin, broker share</td><td>−{pct(broker)}</td></tr>
        <tr><td>Margin, Agyal share</td><td>−{pct(platform)}</td></tr>
        <tr className="sub"><td>Client yield before tax</td><td>{pct(client)}</td></tr>
        <tr><td>Tax on the yield ({pct(e.taxRates.TREASURY_BOND, 0)})</td><td>−{pct(tax)}</td></tr>
        <tr className="sub"><td>Client net yield (after tax)</td><td>{pct(net)}</td></tr>
        <tr><td>Bank deposit, same term (tax-exempt)</td><td>{pct(deposit)}</td></tr>
        <tr className={diff >= 0 ? 'good' : 'bad'}>
          <td>{diff >= 0 ? 'Client is ahead of a deposit by' : 'Client is BELOW a deposit by'}</td>
          <td>{diff >= 0 ? '+' : '−'}{pct(Math.abs(diff))}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** The editable fields; used for the platform defaults and for a broker's overrides. */
function EconomicsForm({ value, onChange, base }: { value: Economics; onChange: (e: Economics) => void; base?: Economics }) {
  const differs = (k: keyof Economics) => base && JSON.stringify(base[k]) !== JSON.stringify(value[k]);
  const bpsField = (k: 'custodyBps' | 'brokerMarginBps' | 'platformMarginBps' | 'commissionBps', label: string) => (
    <label className={differs(k) ? 'override' : ''}>
      {label} (%)
      <input
        inputMode="decimal"
        value={bpsPct(value[k])}
        onChange={(ev) => onChange({ ...value, [k]: Math.round(Number(ev.target.value || 0) * 100) })}
      />
    </label>
  );
  return (
    <div className="fields">
      {bpsField('custodyBps', 'Custody & operations')}
      {bpsField('brokerMarginBps', 'Broker margin')}
      {bpsField('platformMarginBps', 'Agyal margin')}
      {bpsField('commissionBps', 'Commission per trade, of face value')}
      <label className={differs('commissionMin') ? 'override' : ''}>
        Minimum commission (EGP)
        <input value={value.commissionMin} onChange={(ev) => onChange({ ...value, commissionMin: ev.target.value })} />
      </label>
      <fieldset>
        <legend>Tax on interest</legend>
        {PAPERS.map(([k, label]) => (
          <label key={k} className={base && base.taxRates[k] !== value.taxRates[k] ? 'override' : ''}>
            {label} (%)
            <input
              inputMode="decimal"
              value={(value.taxRates[k] * 100).toString()}
              onChange={(ev) => onChange({ ...value, taxRates: { ...value.taxRates, [k]: Number(ev.target.value || 0) / 100 } })}
            />
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Bank deposit rates (for comparison)</legend>
        {TENORS.map(([k, label]) => (
          <label key={k} className={base && base.depositRates[k] !== value.depositRates[k] ? 'override' : ''}>
            {label} (%)
            <input
              inputMode="decimal"
              value={(value.depositRates[k] * 100).toString()}
              onChange={(ev) => onChange({ ...value, depositRates: { ...value.depositRates, [k]: Number(ev.target.value || 0) / 100 } })}
            />
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input
          type="checkbox"
          checked={value.showBreakdownToClients}
          onChange={(ev) => onChange({ ...value, showBreakdownToClients: ev.target.checked })}
        />
        Show clients the full breakdown (custody, broker and Agyal margins)
      </label>
    </div>
  );
}

/** Only the fields that differ from the platform defaults. */
function diff(base: Economics, e: Economics): Partial<Economics> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(e) as (keyof Economics)[]) {
    if (k === 'taxRates' || k === 'depositRates') {
      const d = Object.fromEntries(Object.entries(e[k]).filter(([kk, v]) => (base[k] as Record<string, number>)[kk] !== v));
      if (Object.keys(d).length) out[k] = d;
    } else if (base[k] !== e[k]) out[k] = e[k];
  }
  return out as Partial<Economics>;
}

export function EconomicsScreen() {
  const { data, error, reload } = useLoad<{ defaults: Economics; brokers: BrokerRow[] }>('/admin/economics');
  const revenue = useLoad<RevenueRow[]>('/admin/revenue');
  const [draft, setDraft] = useState<Economics | null>(null);
  const [editing, setEditing] = useState<{ slug: string; name: string; value: Economics } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft(data.defaults);
  }, [data, draft]);

  async function saveDefaults() {
    setErr(null);
    setMsg(null);
    try {
      await api('PUT', '/admin/economics', draft);
      setMsg('Platform defaults saved. New quotes use them straight away.');
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function saveBroker() {
    if (!editing || !data) return;
    setErr(null);
    try {
      await api('PUT', `/admin/tenants/${editing.slug}/economics`, diff(data.defaults, editing.value));
      setEditing(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function resetBroker(slug: string) {
    if (!confirm('Use the platform defaults for this broker?')) return;
    await api('DELETE', `/admin/tenants/${slug}/economics`);
    reload();
  }

  if (error) return <p className="error">{error}</p>;
  if (!data || !draft) return <p>Loading…</p>;
  const total = draft.custodyBps + draft.brokerMarginBps + draft.platformMarginBps;

  return (
    <section>
      <h2>Economics</h2>
      <p className="muted">
        How a client's return is built from the market yield. Custody, the broker's margin and Agyal's margin are taken
        from the yield on every trade and booked separately in each broker's ledger. Existing trades keep the economics
        they were done at.
      </p>

      <div className="econ-grid">
        <div className="card">
          <h3>Platform defaults</h3>
          <EconomicsForm value={draft} onChange={setDraft} />
          <p className={total > draft.maxTotalDeductionBps ? 'error' : 'muted'}>
            Total taken from the yield: {bpsPct(total)}% (limit {bpsPct(draft.maxTotalDeductionBps)}%)
          </p>
          <button className="primary" onClick={saveDefaults}>Save defaults</button>
          {msg ? <p className="ok">{msg}</p> : null}
          {err && !editing ? <p className="error">{err}</p> : null}
        </div>
        <div className="card">
          <Waterfall e={draft} />
        </div>
      </div>

      <h3>Brokers</h3>
      <table>
        <thead>
          <tr><th>Broker</th><th>Custody</th><th>Broker</th><th>Agyal</th><th>Commission</th><th>Papers below deposit</th><th></th></tr>
        </thead>
        <tbody>
          {data.brokers.map((b) => {
            const o = b.overrides as Record<string, unknown>;
            const cell = (k: keyof Economics, v: string) => <td className={k in o ? 'override' : ''}>{v}</td>;
            return (
              <tr key={b.slug}>
                <td>{b.name}{b.kind === 'PROSPECT_DEMO' ? <span className="muted"> · demo</span> : null}</td>
                {cell('custodyBps', `${bpsPct(b.effective.custodyBps)}%`)}
                {cell('brokerMarginBps', `${bpsPct(b.effective.brokerMarginBps)}%`)}
                {cell('platformMarginBps', `${bpsPct(b.effective.platformMarginBps)}%`)}
                {cell('commissionBps', b.effective.commissionBps ? `${bpsPct(b.effective.commissionBps)}%` : 'none')}
                <td className={b.papersBelowDeposit ? 'error' : ''}>{b.papersBelowDeposit || '–'}</td>
                <td>
                  <button className="link" onClick={() => { setErr(null); setEditing({ slug: b.slug, name: b.name, value: b.effective }); }}>Edit</button>
                  {Object.keys(o).length ? <> · <button className="link" onClick={() => resetBroker(b.slug)}>Use defaults</button></> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">Highlighted values differ from the platform defaults.</p>

      {editing ? (
        <div className="econ-grid">
          <div className="card">
            <h3>{editing.name}</h3>
            <EconomicsForm value={editing.value} onChange={(value) => setEditing({ ...editing, value })} base={data.defaults} />
            <button className="primary" onClick={saveBroker}>Save for this broker</button>{' '}
            <button className="link" onClick={() => setEditing(null)}>Cancel</button>
            {err ? <p className="error">{err}</p> : null}
          </div>
          <div className="card">
            <Waterfall e={editing.value} />
          </div>
        </div>
      ) : null}

      <h3>Agyal revenue</h3>
      {revenue.data?.length ? (
        <table>
          <thead><tr><th>Month</th><th>Broker</th><th>Trades</th><th>Volume</th><th>Agyal fee</th><th>Broker revenue</th><th>Custody</th></tr></thead>
          <tbody>
            {revenue.data.map((r) => (
              <tr key={`${r.month}-${r.slug}`}>
                <td>{r.month}</td><td>{r.name}</td><td>{r.trades}</td><td>{egp(r.volume)}</td>
                <td><strong>{egp(r.platformFee)}</strong></td><td>{egp(r.brokerRevenue)}</td><td>{egp(r.custodyFee)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td><strong>{egp(revenue.data.reduce((s, r) => s + Number(r.platformFee), 0))}</strong></td>
              <td>{egp(revenue.data.reduce((s, r) => s + Number(r.brokerRevenue), 0))}</td>
              <td>{egp(revenue.data.reduce((s, r) => s + Number(r.custodyFee), 0))}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="muted">No trades yet.</p>
      )}
    </section>
  );
}

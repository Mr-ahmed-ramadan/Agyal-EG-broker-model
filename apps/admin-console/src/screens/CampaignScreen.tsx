import { useState } from 'react';
import { download } from '../api';
import { egp, useLoad, when } from '../useLoad';

interface DemoPerson {
  name: string | null;
  email: string | null;
  phone: string | null;
  tradedSimulated: boolean;
  createdAt: string;
}

interface WaitlistPerson {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  governorate: string | null;
  amountBand: string | null;
  savesIn: string | null;
  source: string | null;
  createdAt: string;
}

interface Note {
  message: string;
  email: string | null;
  locale: string;
  source: string | null;
  createdAt: string;
}

type Tally = Record<string, number>;

interface Demand {
  demo: {
    accounts: number;
    placedAnOrder: number;
    conversion: number;
    orders: number;
    simulatedNominalEgp: string;
    withPhone: number;
    recent: DemoPerson[];
  };
  feedback: { total: number; recent: Note[] };
  signups: {
    total: number;
    withAmountBand: number;
    estimatedIntendedEgp: number;
    byGovernorate: Tally;
    byAmountBand: Tally;
    bySavesIn: Tally;
    bySource: Tally;
    byLocale: Tally;
    recent: WaitlistPerson[];
  };
  calculator: { total: number; byAmountBand: Tally; byTenor: Tally };
}

const LABEL: Record<string, string> = {
  UNDER_10K: 'Under 10k',
  FROM_10K_TO_50K: '10k – 50k',
  FROM_50K_TO_250K: '50k – 250k',
  FROM_250K_TO_1M: '250k – 1m',
  OVER_1M: 'Over 1m',
  DEPOSIT: 'Bank deposit',
  CERTIFICATE: 'Certificates',
  GOLD: 'Gold',
  NONE: 'Not invested',
  OTHER: 'Something else',
  ar: 'Arabic',
  en: 'English',
};

/** Enum keys (CAIRO, KAFR_EL_SHEIKH) read as words, not as shouting. */
const pretty = (k: string) => {
  if (LABEL[k]) return LABEL[k];
  const words = k.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * A counted breakdown, biggest first. Empty tallies render nothing.
 *
 * `label` exists because the calculator stores the term of the paper the person
 * was actually quoted, not the tenor they picked: asking for 3 months quotes a
 * bill with 87 days left, and "87 days" is the honest label for that.
 */
function Counts({ title, tally, label = pretty }: { title: string; tally: Tally; label?: (k: string) => string }) {
  const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  return (
    <div className="card">
      <p className="count-title">{title}</p>
      <ul className="plain small">
        {rows.map(([k, n]) => (
          <li key={k} className="row"><span>{label(k)}</span><span>{n}</span></li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The retail campaign: who opened a demo account, who asked to be told when we
 * open, what people typed into the calculator, and what they told us about the
 * beta. Read-only; the only action is exporting the contacts to follow them up.
 */
export function CampaignScreen() {
  const { data, error } = useLoad<Demand>('/admin/campaign/demand');
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'demo' | 'waitlist'>('demo');

  if (error) return <section><h2>Campaign</h2><p className="error">{error}</p></section>;
  if (!data) return <section><h2>Campaign</h2><p className="muted">Loading…</p></section>;

  const { demo, signups, calculator, feedback } = data;
  const nothingYet = demo.accounts === 0 && signups.total === 0 && calculator.total === 0;

  return (
    <section>
      <h2>Campaign</h2>
      <p className="muted">
        The retail funnel from the public page: demo accounts opened, people waiting to be told
        when we open, calculator use and beta feedback. Nobody here is a real client.
      </p>

      {nothingYet ? (
        <p className="muted">Nothing yet. Numbers appear as soon as the campaign runs.</p>
      ) : null}

      <div className="kpis">
        <div className="kpi static"><strong>{demo.accounts}</strong><span>Demo accounts</span></div>
        <div className="kpi static"><strong>{demo.placedAnOrder}</strong><span>Placed an order</span></div>
        <div className="kpi static">
          <strong>{Math.round(demo.conversion * 100)}%</strong><span>Opened → traded</span>
        </div>
        <div className="kpi static"><strong>{demo.withPhone}</strong><span>Left a phone number</span></div>
        <div className="kpi static"><strong>{demo.orders}</strong><span>Simulated orders</span></div>
        <div className="kpi static">
          <strong>{egp(demo.simulatedNominalEgp)}</strong><span>Simulated nominal</span>
        </div>
        <div className="kpi static"><strong>{calculator.total}</strong><span>Calculator runs</span></div>
        <div className="kpi static"><strong>{signups.total}</strong><span>On the waiting list</span></div>
      </div>

      <div className="filters">
        <button type="button" className={tab === 'demo' ? 'on' : ''} onClick={() => setTab('demo')}>
          Demo accounts ({demo.recent.length})
        </button>
        <button type="button" className={tab === 'waitlist' ? 'on' : ''} onClick={() => setTab('waitlist')}>
          Waiting list ({signups.recent.length})
        </button>
        <button type="button" onClick={() => download('/admin/campaign/export').catch((e) => setExportErr((e as Error).message))}>
          Export contacts CSV
        </button>
      </div>
      {exportErr ? <p className="error">{exportErr}</p> : null}

      {tab === 'demo' ? (
        demo.recent.length === 0 ? (
          <p className="muted">No demo accounts yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Traded</th><th>Opened</th></tr>
            </thead>
            <tbody>
              {demo.recent.map((p) => (
                <tr key={`${p.email}-${p.createdAt}`}>
                  <td>{p.name ?? '—'}</td>
                  <td>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '—'}</td>
                  <td>{p.phone ? <a href={`tel:${p.phone.replace(/\s/g, '')}`}>{p.phone}</a> : '—'}</td>
                  <td><span className={`badge ${p.tradedSimulated ? 'ok' : 'mute'}`}>{p.tradedSimulated ? 'Yes' : 'No'}</span></td>
                  <td>{when(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : signups.recent.length === 0 ? (
        <p className="muted">Nobody on the waiting list.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Mobile</th><th>Governorate</th><th>Would start with</th><th>Saves in</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {signups.recent.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : '—'}</td>
                <td>{s.mobile ? <a href={`tel:${s.mobile.replace(/\s/g, '')}`}>{s.mobile}</a> : '—'}</td>
                <td>{s.governorate ? pretty(s.governorate) : '—'}</td>
                <td>{s.amountBand ? pretty(s.amountBand) : '—'}</td>
                <td>{s.savesIn ? pretty(s.savesIn) : '—'}</td>
                <td>{when(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>What they told us</h3>
      {feedback.recent.length === 0 ? (
        <p className="muted">No feedback yet.</p>
      ) : (
        feedback.recent.map((f) => (
          <div key={`${f.createdAt}-${f.message.slice(0, 12)}`} className="card">
            <div className="row">
              <span className="muted">
                {f.locale === 'ar' ? 'Arabic' : 'English'}
                {f.source ? ` · ${f.source}` : ''}
              </span>
              <span className="muted">{when(f.createdAt)}</span>
            </div>
            <p className="quote">{f.message}</p>
            {f.email ? <p className="muted">Wants a reply: <a href={`mailto:${f.email}`}>{f.email}</a></p> : null}
          </div>
        ))
      )}

      <h3>Demand</h3>
      <p className="muted">
        What the waiting list and the calculator say about size and where people are. The
        estimate comes from band midpoints, so treat it as an order of magnitude.
        {signups.withAmountBand > 0 ? ` Based on ${signups.withAmountBand} of ${signups.total} who gave a band: ${egp(signups.estimatedIntendedEgp)}.` : ''}
      </p>
      <div className="tiles">
        <Counts title="Would start with" tally={signups.byAmountBand} />
        <Counts title="Saves in" tally={signups.bySavesIn} />
        <Counts title="Governorate" tally={signups.byGovernorate} />
        <Counts title="Came from" tally={signups.bySource} />
        <Counts title="Language" tally={signups.byLocale} />
        <Counts title="Calculator: amount" tally={calculator.byAmountBand} />
        <Counts title="Calculator: term quoted" tally={calculator.byTenor} label={(d) => `${d} days`} />
      </div>
    </section>
  );
}

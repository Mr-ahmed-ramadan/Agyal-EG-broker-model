import { useEffect, useState } from 'react';
import { api } from '../api';
import { when } from '../useLoad';

interface Flag {
  id: string;
  reason: string;
  note: string;
  status: 'OPEN' | 'RESOLVED';
  raisedAt: string;
  brokerResponse: string | null;
  resolvedAt: string | null;
}

interface Row {
  id: string;
  broker: { slug: string; name: string; kind: string };
  name: string | null;
  nameAr: string | null;
  email: string | null;
  nationalIdLast4: string | null;
  status: string;
  riskRating: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionBy: string | null;
  decisionNote: string | null;
  daysInQueue: number;
  ekyc: { passed: boolean; reasons: string[]; faceMatchScore: number | null } | null;
  aml: { flag: 'NONE' | 'PEP' | 'SANCTIONS' | 'HIT'; riskRating: string | null; isPep: boolean; hits: { list: string; name: string }[] } | null;
  unifiedCode: { status: string } | null;
  kycReviewDueAt: string | null;
  reviewOverdue: boolean;
  openFlags: number;
  flags: Flag[];
}

interface View {
  kpis: { awaitingReview: number; needsInfo: number; amlHits: number; reviewsOverdue: number; openFlags: number; total: number };
  clients: Row[];
  brokers: { slug: string; name: string }[];
}

interface Detail {
  client: Record<string, unknown> & { consents: { type: string; version: string; acceptedAt: string; ip: string | null }[] };
  broker: { slug: string; legalNameEn: string };
  flags: Flag[];
  audit: { id: string; action: string; actorId: string | null; data: unknown; createdAt: string }[];
}

const REASONS: [string, string][] = [
  ['PEP_NOT_ESCALATED', 'PEP not escalated / no enhanced due diligence'],
  ['SANCTIONS_HIT', 'Possible sanctions match'],
  ['ADVERSE_MEDIA', 'Adverse media'],
  ['REVIEW_OVERDUE', 'Periodic KYC review overdue'],
  ['DOCUMENTS', 'Missing or inconsistent documents'],
  ['OTHER', 'Other'],
];

const AML_BADGE: Record<string, [string, string]> = {
  NONE: ['ok', 'Clear'],
  HIT: ['warn', 'Screening hit'],
  PEP: ['warn', 'PEP'],
  SANCTIONS: ['bad', 'Sanctions'],
};
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'ok',
  PENDING_APPROVAL: 'warn',
  NEEDS_INFO: 'warn',
  REJECTED: 'bad',
  SUSPENDED: 'bad',
  ONBOARDING: 'mute',
};

/** Agyal's view of every broker's clients: eKYC, AML screening, queue age, reviews due, flags. */
export function KycAmlScreen() {
  const [filter, setFilter] = useState({ tenant: '', status: '', aml: '', overdue: false, flagged: false, q: '' });
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    const qs = new URLSearchParams();
    if (filter.tenant) qs.set('tenant', filter.tenant);
    if (filter.status) qs.set('status', filter.status);
    if (filter.aml) qs.set('aml', filter.aml);
    if (filter.overdue) qs.set('overdue', 'true');
    if (filter.flagged) qs.set('flagged', 'true');
    if (filter.q) qs.set('q', filter.q);
    api<View>('GET', `/admin/compliance/clients?${qs}`).then(setView).catch((e) => setError((e as Error).message));
  }
  useEffect(load, [filter.tenant, filter.status, filter.aml, filter.overdue, filter.flagged]); // eslint-disable-line react-hooks/exhaustive-deps

  const k = view?.kpis;
  return (
    <section>
      <h2>KYC / AML monitoring</h2>
      <p className="muted">
        Every broker's clients, as screened at onboarding. Brokers are the licensed party and decide on each client; Agyal
        monitors and raises flags, which appear in the broker's compliance queue.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {k ? (
        <div className="kpis">
          <button className={`kpi ${filter.status === 'PENDING_APPROVAL' ? 'on' : ''}`} onClick={() => setFilter({ ...filter, status: filter.status === 'PENDING_APPROVAL' ? '' : 'PENDING_APPROVAL' })}>
            <strong>{k.awaitingReview}</strong><span>Awaiting broker review</span>
          </button>
          <button className={`kpi ${filter.status === 'NEEDS_INFO' ? 'on' : ''}`} onClick={() => setFilter({ ...filter, status: filter.status === 'NEEDS_INFO' ? '' : 'NEEDS_INFO' })}>
            <strong>{k.needsInfo}</strong><span>Needs info</span>
          </button>
          <button className={`kpi ${filter.aml === 'ANY' ? 'on' : ''}`} onClick={() => setFilter({ ...filter, aml: filter.aml === 'ANY' ? '' : 'ANY' })}>
            <strong>{k.amlHits}</strong><span>AML hits (PEP, sanctions, other)</span>
          </button>
          <button className={`kpi ${filter.overdue ? 'on' : ''}`} onClick={() => setFilter({ ...filter, overdue: !filter.overdue })}>
            <strong>{k.reviewsOverdue}</strong><span>KYC reviews overdue</span>
          </button>
          <button className={`kpi ${filter.flagged ? 'on' : ''}`} onClick={() => setFilter({ ...filter, flagged: !filter.flagged })}>
            <strong>{k.openFlags}</strong><span>Open Agyal flags</span>
          </button>
          <div className="kpi static"><strong>{k.total}</strong><span>Clients</span></div>
        </div>
      ) : null}

      <div className="filters">
        <select value={filter.tenant} onChange={(e) => setFilter({ ...filter, tenant: e.target.value })} aria-label="Broker">
          <option value="">All brokers</option>
          {view?.brokers.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          {['ONBOARDING', 'PENDING_APPROVAL', 'NEEDS_INFO', 'ACTIVE', 'REJECTED', 'SUSPENDED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
        </select>
        <select value={filter.aml} onChange={(e) => setFilter({ ...filter, aml: e.target.value })} aria-label="AML">
          <option value="">Any AML result</option>
          <option value="ANY">Any hit</option>
          <option value="PEP">PEP</option>
          <option value="SANCTIONS">Sanctions</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="inline">
          <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="Name, deposit ref or ID last 4" aria-label="Search" />
          <button>Search</button>
        </form>
      </div>

      <table>
        <thead>
          <tr><th>Client</th><th>Broker</th><th>Status</th><th>eKYC</th><th>AML</th><th>Risk</th><th>In queue</th><th>Review due</th><th>Flags</th><th></th></tr>
        </thead>
        <tbody>
          {view?.clients.map((r) => (
            <tr key={r.id} className={r.openFlags ? 'flagged' : ''}>
              <td>{r.name ?? '—'}<br /><span className="muted">•••• {r.nationalIdLast4 ?? '—'}</span></td>
              <td>{r.broker.name}{r.broker.kind === 'PROSPECT_DEMO' ? <span className="muted"> · demo</span> : null}</td>
              <td><span className={`badge ${STATUS_BADGE[r.status] ?? ''}`}>{r.status.replace('_', ' ').toLowerCase()}</span></td>
              <td>{r.ekyc ? <span className={`badge ${r.ekyc.passed ? 'ok' : 'bad'}`}>{r.ekyc.passed ? 'Passed' : 'Failed'}</span> : '—'}</td>
              <td>{r.aml ? <span className={`badge ${AML_BADGE[r.aml.flag][0]}`}>{AML_BADGE[r.aml.flag][1]}</span> : '—'}</td>
              <td>{r.riskRating ?? '—'}</td>
              <td>{r.daysInQueue ? `${r.daysInQueue} d` : '—'}</td>
              <td className={r.reviewOverdue ? 'error' : ''}>{r.kycReviewDueAt ? r.kycReviewDueAt.slice(0, 10) : '—'}</td>
              <td>{r.openFlags ? <span className="badge warn">{r.openFlags} open</span> : r.flags.length ? <span className="muted">{r.flags.length} resolved</span> : '—'}</td>
              <td><button className="link" onClick={() => setOpen(r.id)}>Review</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {view && view.clients.length === 0 ? <p className="muted">No clients match these filters.</p> : null}

      {open ? <ClientDrawer id={open} row={view?.clients.find((r) => r.id === open)} onClose={() => setOpen(null)} onFlagged={load} /> : null}
    </section>
  );
}

function ClientDrawer({ id, row, onClose, onFlagged }: { id: string; row?: Row; onClose: () => void; onFlagged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [reason, setReason] = useState('PEP_NOT_ESCALATED');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<Detail>('GET', `/admin/compliance/clients/${id}`).then(setD).catch((e) => setErr((e as Error).message));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function flag() {
    setErr(null);
    try {
      await api('POST', '/admin/compliance/flags', { clientId: id, reason, note });
      setNote('');
      await load();
      onFlagged();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="drawer" role="dialog" aria-label="Client review">
      <div className="drawer-body">
        <div className="row"><h3>{row?.name ?? 'Client'}</h3><button className="link" onClick={onClose}>Close</button></div>
        {row ? (
          <dl>
            <dt>Broker</dt><dd>{row.broker.name}</dd>
            <dt>Email</dt><dd>{row.email ?? '—'}</dd>
            <dt>National ID</dt><dd>•••• {row.nationalIdLast4} (full number encrypted)</dd>
            <dt>Status</dt><dd>{row.status}</dd>
            <dt>Submitted</dt><dd>{row.submittedAt ? when(row.submittedAt) : '—'}</dd>
            <dt>Decision</dt><dd>{row.decidedAt ? `${when(row.decidedAt)} · ${row.decisionBy?.startsWith('auto') || row.decisionBy?.includes('-v') ? 'auto-approval rules' : 'broker compliance'}` : 'Pending'}{row.decisionNote ? ` — ${row.decisionNote}` : ''}</dd>
            <dt>eKYC</dt><dd>{row.ekyc ? `${row.ekyc.passed ? 'Passed' : 'Failed'}${row.ekyc.faceMatchScore ? ` · face match ${row.ekyc.faceMatchScore}` : ''}${row.ekyc.reasons.length ? ` · ${row.ekyc.reasons.join(', ')}` : ''}` : '—'}</dd>
            <dt>AML screening</dt><dd>{row.aml ? `${row.aml.riskRating} risk${row.aml.isPep ? ' · PEP' : ''}${row.aml.hits.length ? ` · ${row.aml.hits.map((h) => `${h.list}: ${h.name}`).join('; ')}` : ' · no list hits'}` : '—'}</dd>
            <dt>Unified code</dt><dd>{row.unifiedCode?.status ?? '—'}</dd>
            <dt>Next KYC review</dt><dd className={row.reviewOverdue ? 'error' : ''}>{row.kycReviewDueAt ? row.kycReviewDueAt.slice(0, 10) : '—'}{row.reviewOverdue ? ' · overdue' : ''}</dd>
          </dl>
        ) : null}
        {d ? (
          <>
            <h4>Consents</h4>
            <ul className="plain">{d.client.consents.map((c) => <li key={c.type}>{c.type} v{c.version} · {when(c.acceptedAt)}{c.ip ? ` · ${c.ip}` : ''}</li>)}</ul>
            <h4>Agyal flags</h4>
            {d.flags.length === 0 ? <p className="muted">None.</p> : null}
            {d.flags.map((f) => (
              <div key={f.id} className={`flag ${f.status}`}>
                <strong>{REASONS.find(([k]) => k === f.reason)?.[1] ?? f.reason}</strong> · {f.status === 'OPEN' ? 'open' : 'resolved'} · {when(f.raisedAt)}
                <p>{f.note}</p>
                {f.brokerResponse ? <p className="muted">Broker: {f.brokerResponse} ({f.resolvedAt ? when(f.resolvedAt) : ''})</p> : null}
              </div>
            ))}
            <h4>Raise a flag to the broker</h4>
            <div className="fields">
              <label>Reason<select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>Note to the broker<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the broker check or do?" /></label>
            </div>
            <button className="primary" disabled={note.trim().length < 5} onClick={flag}>Send flag to broker</button>
            {err ? <p className="error">{err}</p> : null}
            <h4>Audit trail</h4>
            <ul className="plain small">
              {d.audit.map((a) => <li key={a.id}>{when(a.createdAt)} · {a.action}</li>)}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../api';
import { useLoad, when } from '../useLoad';

interface QueueItem {
  id: string;
  fullNameEn: string | null;
  fullNameAr: string | null;
  nationalIdLast4: string | null;
  riskRating: string | null;
  riskProfile: string | null;
  createdAt: string;
  onboarding: {
    ekycResult: { passed: boolean; reasons: string[]; faceMatchScore?: number } | null;
    amlResult: { riskRating: string; isPep: boolean; hits: { list: string; name: string }[] } | null;
    profile: Record<string, unknown> | null;
    decisionNote: string | null;
  } | null;
}

export function ComplianceScreen() {
  const { data, error, reload } = useLoad<QueueItem[]>('/broker/compliance/queue');
  return (
    <section>
      <h2>Compliance queue</h2>
      <p className="muted">Applications the auto-approval rules could not clear. Every decision is recorded against your user.</p>
      <AgyalFlags />
      {error ? <p className="error">{error}</p> : null}
      {data?.length === 0 ? <p className="muted">Nothing waiting for review.</p> : null}
      {data?.map((c) => <Review key={c.id} item={c} onDone={reload} />)}
    </section>
  );
}

function Review({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ob = item.onboarding;
  async function decide(decision: 'APPROVE' | 'REJECT' | 'NEEDS_INFO') {
    try {
      await api('POST', `/broker/compliance/${item.id}/decision`, { decision, note });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <article className="card">
      <header className="row">
        <strong>{item.fullNameEn} <span dir="rtl">{item.fullNameAr}</span></strong>
        <span className="muted">Applied {when(item.createdAt)}</span>
      </header>
      <p className="warn">Flags: {ob?.decisionNote ?? '-'}</p>
      <dl>
        <dt>National ID</dt><dd>•••• {item.nationalIdLast4}</dd>
        <dt>eKYC</dt><dd>{ob?.ekycResult?.passed ? 'Passed' : `Failed: ${ob?.ekycResult?.reasons.join(', ')}`}{ob?.ekycResult?.faceMatchScore ? ` (face match ${ob.ekycResult.faceMatchScore})` : ''}</dd>
        <dt>AML rating</dt><dd>{ob?.amlResult?.riskRating}{ob?.amlResult?.isPep ? ' · PEP' : ''}</dd>
        <dt>Screening hits</dt><dd>{ob?.amlResult?.hits.map((h) => `${h.list}: ${h.name}`).join(', ') || 'None'}</dd>
        <dt>Risk profile</dt><dd>{item.riskProfile}</dd>
        <dt>Occupation</dt><dd>{String(ob?.profile?.occupation ?? '')}</dd>
        <dt>Income / source</dt><dd>{String(ob?.profile?.incomeBand ?? '')} / {String(ob?.profile?.sourceOfFunds ?? '')}</dd>
      </dl>
      <label>
        Decision note (required)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Enhanced due diligence completed" />
      </label>
      <div className="actions">
        <button className="primary" disabled={note.length < 3} onClick={() => decide('APPROVE')}>Approve</button>
        <button disabled={note.length < 3} onClick={() => decide('NEEDS_INFO')}>Request information</button>
        <button className="danger" disabled={note.length < 3} onClick={() => decide('REJECT')}>Reject</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}

interface Flag {
  id: string;
  reason: string;
  note: string;
  status: 'OPEN' | 'RESOLVED';
  raisedAt: string;
  brokerResponse: string | null;
  resolvedAt: string | null;
  client: { fullNameEn: string | null; fullNameAr: string | null; status: string; riskRating: string | null } | null;
}

const REASON_LABEL: Record<string, string> = {
  PEP_NOT_ESCALATED: 'PEP not escalated / no enhanced due diligence',
  SANCTIONS_HIT: 'Possible sanctions match',
  ADVERSE_MEDIA: 'Adverse media',
  REVIEW_OVERDUE: 'Periodic KYC review overdue',
  DOCUMENTS: 'Missing or inconsistent documents',
  OTHER: 'Other',
};

/** Concerns raised by Agyal's KYC/AML monitoring; the broker responds and resolves. */
function AgyalFlags() {
  const { data, reload } = useLoad<Flag[]>('/broker/compliance/flags');
  const open = data?.filter((f) => f.status === 'OPEN') ?? [];
  const resolved = data?.filter((f) => f.status === 'RESOLVED') ?? [];
  if (!data || data.length === 0) return null;
  return (
    <div className="card flags">
      <h3>Flags from Agyal monitoring ({open.length} open)</h3>
      {open.map((f) => <FlagItem key={f.id} flag={f} onDone={reload} />)}
      {resolved.length ? (
        <details>
          <summary className="muted">{resolved.length} resolved</summary>
          {resolved.map((f) => (
            <p key={f.id} className="muted">
              {f.client?.fullNameEn} · {REASON_LABEL[f.reason] ?? f.reason} · resolved {f.resolvedAt ? when(f.resolvedAt) : ''}: {f.brokerResponse}
            </p>
          ))}
        </details>
      ) : null}
    </div>
  );
}

function FlagItem({ flag, onDone }: { flag: Flag; onDone: () => void }) {
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function resolve() {
    setError(null);
    try {
      await api('POST', `/broker/compliance/flags/${flag.id}/resolve`, { response });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <article className="flag-item">
      <header className="row">
        <strong>{flag.client?.fullNameEn ?? 'Client'} · {REASON_LABEL[flag.reason] ?? flag.reason}</strong>
        <span className="muted">Raised {when(flag.raisedAt)}</span>
      </header>
      <p>{flag.note}</p>
      <p className="muted">Client status: {flag.client?.status}{flag.client?.riskRating ? ` · ${flag.client.riskRating} risk` : ''}</p>
      <label>
        Your response (what was checked or done)
        <textarea rows={2} value={response} onChange={(e) => setResponse(e.target.value)} />
      </label>
      <div className="actions">
        <button className="primary" disabled={response.trim().length < 5} onClick={resolve}>Respond and resolve</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}

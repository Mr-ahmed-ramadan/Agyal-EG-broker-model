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

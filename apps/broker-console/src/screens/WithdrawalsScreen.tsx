import { useState } from 'react';
import { api } from '../api';
import { egp, useLoad, when } from '../useLoad';

interface Withdrawal {
  id: string;
  clientName: string | null;
  amount: string;
  status: 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  iban: string;
  bankName: string;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  bankReference: string | null;
  rejectReason: string | null;
}

export function WithdrawalsScreen({ roles }: { roles: string[] }) {
  const { data, error, reload } = useLoad<Withdrawal[]>('/broker/withdrawals');
  const canApprove = roles.some((r) => r === 'BROKER_FINANCE' || r === 'BROKER_ADMIN');
  const canPay = roles.some((r) => r === 'BROKER_OPS' || r === 'BROKER_FINANCE' || r === 'BROKER_ADMIN');
  return (
    <section>
      <h2>Withdrawals</h2>
      <p className="muted">
        Clients withdraw settled cash to their own bank account. Finance approves; a different person transfers the
        money from the client-money account and records the bank reference.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {data?.length === 0 ? <p className="muted">No withdrawals yet.</p> : null}
      {data?.map((w) => (
        <Item key={w.id} w={w} canApprove={canApprove} canPay={canPay} onDone={reload} />
      ))}
    </section>
  );
}

function Item({ w, canApprove, canPay, onDone }: { w: Withdrawal; canApprove: boolean; canPay: boolean; onDone: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function act(path: string, body?: unknown) {
    setError(null);
    try {
      await api('POST', `/broker/withdrawals/${w.id}/${path}`, body);
      setText('');
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <article className="card">
      <header className="row">
        <strong>
          {w.clientName} · {egp(w.amount)}
        </strong>
        <span className={`badge ${w.status}`}>{w.status}</span>
      </header>
      <p className="muted">
        To {w.bankName} <span className="mono">{w.iban}</span> · requested {when(w.requestedAt)}
        {w.bankReference ? ` · paid, ref ${w.bankReference}` : ''}
        {w.rejectReason ? ` · rejected: ${w.rejectReason}` : ''}
      </p>
      {w.status === 'REQUESTED' && canApprove ? (
        <div className="actions">
          <button className="primary" onClick={() => act('approve')}>Approve</button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reason to reject" />
          <button className="danger" disabled={text.length < 3} onClick={() => act('reject', { reason: text })}>Reject</button>
        </div>
      ) : null}
      {w.status === 'APPROVED' && canPay ? (
        <div className="actions">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Bank transfer reference" />
          <button className="primary" disabled={text.length < 3} onClick={() => act('paid', { bankReference: text })}>
            Record payment
          </button>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}

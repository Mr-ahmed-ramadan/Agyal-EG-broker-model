import { useEffect } from 'react';
import { useLoad, when } from '../useLoad';

interface Health {
  outbox: Record<string, number>;
  oldestPendingSince: string | null;
  inboxPending: number;
  inboxErrors: { id: string; msgType: string; error: string; receivedAt: string }[];
  sessions: { sessionId: string; messages: number; lastMessageAt: string }[];
}

interface FixMessage { id: string; sessionId: string; direction: string; msgType: string; seqNum: number; raw: string; createdAt: string }

const MSG: Record<string, string> = { R: 'QuoteRequest', S: 'Quote', D: 'NewOrderSingle', '8': 'ExecutionReport', AG: 'QuoteRequestReject' };

export function FixScreen() {
  const health = useLoad<Health>('/admin/fix/health');
  const messages = useLoad<FixMessage[]>('/admin/fix/messages');
  useEffect(() => {
    const t = window.setInterval(() => { health.reload(); messages.reload(); }, 5000);
    return () => window.clearInterval(t);
  }, [health.reload, messages.reload]);
  const h = health.data;
  const stale = h?.oldestPendingSince && Date.now() - new Date(h.oldestPendingSince).getTime() > 60_000;

  return (
    <section>
      <h2>FIX monitor</h2>
      {health.error ? <p className="error">{health.error}</p> : null}
      {h ? (
        <div className="tiles">
          <div className="card"><div className="muted">Outbox sent</div><strong>{h.outbox.SENT ?? 0}</strong></div>
          <div className="card"><div className="muted">Outbox pending</div><strong className={stale ? 'error' : ''}>{h.outbox.PENDING ?? 0}</strong>{stale ? <div className="error">Stuck since {when(h.oldestPendingSince!)} - is the gateway running?</div> : null}</div>
          <div className="card"><div className="muted">Outbox failed</div><strong className={h.outbox.FAILED ? 'error' : ''}>{h.outbox.FAILED ?? 0}</strong></div>
          <div className="card"><div className="muted">Inbox waiting</div><strong>{h.inboxPending}</strong></div>
          <div className="card"><div className="muted">Inbox errors</div><strong className={h.inboxErrors.length ? 'error' : ''}>{h.inboxErrors.length}</strong></div>
        </div>
      ) : null}
      <h3>Sessions</h3>
      <table>
        <thead><tr><th>Session</th><th>Messages</th><th>Last message</th></tr></thead>
        <tbody>{h?.sessions.map((s) => <tr key={s.sessionId}><td className="mono">{s.sessionId}</td><td>{s.messages}</td><td>{when(s.lastMessageAt)}</td></tr>)}</tbody>
      </table>
      {h?.inboxErrors.length ? (
        <>
          <h3>Inbox errors</h3>
          <table>
            <thead><tr><th>#</th><th>Type</th><th>Error</th><th>Received</th></tr></thead>
            <tbody>{h.inboxErrors.map((e) => <tr key={e.id}><td>{e.id}</td><td>{e.msgType}</td><td className="error">{e.error}</td><td>{when(e.receivedAt)}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <h3>Latest messages</h3>
      <table>
        <thead><tr><th>Time</th><th>Dir</th><th>Type</th><th>Seq</th><th>Raw</th></tr></thead>
        <tbody>
          {messages.data?.map((m) => (
            <tr key={m.id}>
              <td>{when(m.createdAt)}</td>
              <td>{m.direction}</td>
              <td>{MSG[m.msgType] ?? m.msgType}</td>
              <td>{m.seqNum}</td>
              <td className="mono raw">{m.raw}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

import { useState } from 'react';
import { api } from '../api';
import { useLoad, when } from '../useLoad';

interface Task {
  clientId: string;
  code: string | null;
  status: 'REQUESTED' | 'EXISTING_DECLARED';
  updatedAt: string;
  client: { fullNameEn: string | null; status: string; nationalIdLast4: string | null };
}

export function UnifiedCodesScreen() {
  const { data, error, reload } = useLoad<Task[]>('/broker/investor-codes/tasks');
  return (
    <section>
      <h2>Unified codes &amp; custody</h2>
      <p className="muted">
        Manual MCDR process: request new codes or verify declared ones with MCDR, then record the code and the
        client&apos;s custody accounts. Clients can trade once this is done.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {data?.length === 0 ? <p className="muted">No pending unified-code tasks.</p> : null}
      {data?.map((t) => <CodeTask key={t.clientId} task={t} onDone={reload} />)}
    </section>
  );
}

function CodeTask({ task, onDone }: { task: Task; onDone: () => void }) {
  const [code, setCode] = useState(task.code ?? '');
  const [mcdr, setMcdr] = useState({ custodian: '', accountNumber: '' });
  const [cbe, setCbe] = useState({ custodian: '', accountNumber: '' });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const custodyAccounts = [
      ...(mcdr.accountNumber ? [{ depository: 'MCDR', ...mcdr }] : []),
      ...(cbe.accountNumber ? [{ depository: 'CBE', ...cbe }] : []),
    ];
    try {
      await api('POST', `/broker/investor-codes/${task.clientId}`, { code, custodyAccounts });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <article className="card">
      <header className="row">
        <strong>{task.client.fullNameEn}</strong>
        <span className="muted">
          {task.status === 'REQUESTED' ? 'New code requested' : 'Existing code declared'} · {when(task.updatedAt)} · client {task.client.status}
        </span>
      </header>
      <div className="fields">
        <label>Unified code<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        <label>MCDR custodian<input value={mcdr.custodian} onChange={(e) => setMcdr({ ...mcdr, custodian: e.target.value })} /></label>
        <label>MCDR account<input value={mcdr.accountNumber} onChange={(e) => setMcdr({ ...mcdr, accountNumber: e.target.value })} /></label>
        <label>T-bill custodian (CBE)<input value={cbe.custodian} onChange={(e) => setCbe({ ...cbe, custodian: e.target.value })} /></label>
        <label>T-bill custody account<input value={cbe.accountNumber} onChange={(e) => setCbe({ ...cbe, accountNumber: e.target.value })} /></label>
      </div>
      <button className="primary" disabled={!code || (!mcdr.accountNumber && !cbe.accountNumber)} onClick={save}>
        Mark verified
      </button>
      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}

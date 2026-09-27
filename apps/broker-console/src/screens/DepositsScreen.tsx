import { useState, type FormEvent } from 'react';
import { api } from '../api';

export function DepositsScreen() {
  const [f, setF] = useState({ depositReference: '', amount: '', bankReference: '' });
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      await api('POST', '/broker/deposits', f);
      setResult(`Posted EGP ${f.amount} to client ${f.depositReference}.`);
      setF({ depositReference: '', amount: '', bankReference: '' });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h2>Confirm a deposit</h2>
      <p className="muted">
        Match a transfer received on the segregated client-money account to the client&apos;s deposit reference.
        Posting the same bank reference twice has no effect.
      </p>
      <form className="card fields" onSubmit={submit}>
        <label>Client deposit reference<input value={f.depositReference} onChange={(e) => setF({ ...f, depositReference: e.target.value.toUpperCase() })} required /></label>
        <label>Amount (EGP)<input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required inputMode="decimal" /></label>
        <label>Bank transaction reference<input value={f.bankReference} onChange={(e) => setF({ ...f, bankReference: e.target.value })} required /></label>
        <button className="primary">Post deposit</button>
        {result ? <p className="ok">{result}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}

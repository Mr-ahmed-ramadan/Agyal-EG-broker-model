import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, openHtml } from '../api';
import { useLoad, when } from '../useLoad';

interface DocumentItem {
  key: string;
  title: string;
  blurb: string;
  internal: boolean;
  opens: number;
  lastOpenedAt: string | null;
  links: number;
}

interface RecipientRow {
  linkId: string;
  recipient: string | null;
  url: string;
  createdAt: string;
  revokedAt: string | null;
  opens: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
}

interface Summary {
  document: DocumentItem;
  totals: { opens: number; recipients: number; last7: number };
  recipients: RecipientRow[];
  recent: { openedAt: string; recipient: string | null; lang: string | null; device: string; ip: string | null }[];
}

/** Tracked documents: one link per recipient, and a log of who opened what and when. */
export function DocumentsScreen() {
  const { data: docs, error: listError, reload: reloadList } = useLoad<DocumentItem[]>('/admin/documents');
  const [key, setKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recipient, setRecipient] = useState('');
  const [created, setCreated] = useState<{ recipient: string; url: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = docs?.find((d) => d.key === key) ?? docs?.[0] ?? null;

  const load = useCallback(() => {
    if (!selected) return;
    api<Summary>('GET', `/admin/documents/${selected.key}`)
      .then((s) => {
        setSummary(s);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [selected?.key]);
  useEffect(load, [load]);

  function pick(k: string) {
    setKey(k);
    setSummary(null);
    setCreated(null);
    setRecipient('');
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (selected.internal && !window.confirm(`“${selected.title}” is an internal document. Create a link anyway? Only send it to Agyal team members.`)) return;
    setError(null);
    try {
      const link = await api<{ recipient: string; url: string }>('POST', `/admin/documents/${selected.key}/links`, { recipient });
      setCreated(link);
      setRecipient('');
      load();
      reloadList();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link', url);
    }
    setCopied(url);
    setTimeout(() => setCopied((c) => (c === url ? null : c)), 2000);
  }

  async function revoke(row: RecipientRow) {
    if (!window.confirm(`Withdraw the link for ${row.recipient ?? 'the general link'}? It will stop working immediately.`)) return;
    try {
      await api('POST', `/admin/documents/links/${row.linkId}/revoke`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function preview() {
    if (!selected) return;
    try {
      await openHtml(`/admin/documents/${selected.key}/preview`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="docs">
      <h2>Documents</h2>
      <p className="muted">
        Distribute every document as a per-recipient tracked link, and see who opened what and when. Nothing is listed publicly — recipients only
        ever get the links you generate here.
      </p>
      {listError && <p className="error">{listError}</p>}

      <div className="doc-picker">
        {docs?.map((d) => (
          <button key={d.key} className={d.key === selected?.key ? 'doc on' : 'doc'} onClick={() => pick(d.key)}>
            <strong>{d.title}</strong>
            {d.internal && <span className="badge REJECTED">Internal</span>}
            <span className="muted">
              {d.opens} open{d.opens === 1 ? '' : 's'} · {d.links} recipient{d.links === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div className="card">
            <div className="row">
              <h3 style={{ margin: 0 }}>{selected.title}</h3>
              <div className="inline">
                <button onClick={preview}>Preview</button>
                <button onClick={() => { load(); reloadList(); }}>Refresh</button>
              </div>
            </div>
            <p className="muted">{selected.blurb}</p>
            {selected.internal && <p className="warn">Internal document — do not send to brokers, prospects or investors.</p>}

            <form onSubmit={create}>
              <h3>Create a tracked link</h3>
              <div className="actions">
                <label style={{ flex: '1 1 260px' }}>
                  Recipient
                  <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Mona Adel — CEO, Delta Securities" required minLength={2} maxLength={120} />
                </label>
                <button className="primary" type="submit" style={{ alignSelf: 'end' }}>Create link</button>
              </div>
            </form>
            {created && (
              <div className="copy highlight card">
                <span className="muted">Link for {created.recipient}</span>
                <a href={created.url} target="_blank" rel="noreferrer" className="mono">{created.url}</a>
                <button onClick={() => copy(created.url)}>{copied === created.url ? 'Copied' : 'Copy'}</button>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </div>

          {summary && summary.document.key === selected.key && (
            <>
              <div className="tiles">
                <div className="card"><span className="muted">Total opens</span><br /><strong>{summary.totals.opens}</strong></div>
                <div className="card"><span className="muted">Recipients</span><br /><strong>{summary.totals.recipients}</strong></div>
                <div className="card"><span className="muted">Opens · last 7 days</span><br /><strong>{summary.totals.last7}</strong></div>
              </div>

              <h3>By recipient</h3>
              <div className="scroll">
                <table>
                  <thead>
                    <tr><th>Recipient</th><th className="num">Opens</th><th>First opened</th><th>Last opened</th><th>Link</th></tr>
                  </thead>
                  <tbody>
                    {summary.recipients.map((r) => (
                      <tr key={r.linkId} style={r.revokedAt ? { opacity: 0.55 } : undefined}>
                        <td>
                          {r.recipient ?? <em>Unattributed (general link)</em>}
                          {r.revokedAt && <><br /><span className="badge REJECTED">Withdrawn {when(r.revokedAt)}</span></>}
                        </td>
                        <td className="num">{r.opens}</td>
                        <td>{r.firstOpenedAt ? when(r.firstOpenedAt) : <span className="muted">Not yet</span>}</td>
                        <td>{r.lastOpenedAt ? when(r.lastOpenedAt) : <span className="muted">—</span>}</td>
                        <td>
                          {!r.revokedAt && (
                            <div className="inline">
                              <button onClick={() => copy(r.url)}>{copied === r.url ? 'Copied' : 'Copy'}</button>
                              <button className="danger" onClick={() => revoke(r)}>Revoke</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Recent opens</h3>
              {summary.recent.length === 0 ? (
                <p className="muted">No opens yet.</p>
              ) : (
                <div className="scroll">
                  <table>
                    <thead>
                      <tr><th>When</th><th>Recipient</th><th>Lang</th><th>Device</th><th>IP</th></tr>
                    </thead>
                    <tbody>
                      {summary.recent.map((o, i) => (
                        <tr key={i}>
                          <td>{when(o.openedAt)}</td>
                          <td>{o.recipient ?? <em className="muted">Unattributed</em>}</td>
                          <td>{o.lang ?? '—'}</td>
                          <td>{o.device}</td>
                          <td className="mono">{o.ip ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

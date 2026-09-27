import { useEffect, useState } from 'react';
import { api, download } from '../api';
import { when } from '../useLoad';

interface ActionRow {
  id: string;
  createdAt: string;
  tenant: string | null;
  actor: string | null;
  action: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  outcome: number | null;
  requestId: string | null;
}

interface ChangeRow {
  id: string;
  at: string;
  tenant: string | null;
  actor: string | null;
  tableName: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  rowId: string | null;
  requestId: string | null;
  changes: Record<string, unknown>;
}

interface Page<R> {
  total: number;
  facets: { entities: string[]; actions: string[] };
  rows: R[];
}

const TAKE = 50;
const EMPTY = { tenant: '', actor: '', action: '', entity: '', from: '', to: '', text: '' };

function shortUa(ua: string | null): string {
  if (!ua) return '';
  const os = /iphone|ipad|ios/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : /linux/i.test(ua) ? 'Linux' : '';
  const br = /edg/i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : /node|curl/i.test(ua) ? 'Script' : 'Browser';
  return [br, os].filter(Boolean).join(' · ');
}

/** Everything that happened: requests and business actions, and every data change with before/after. */
export function AuditLogScreen() {
  const [type, setType] = useState<'actions' | 'changes'>('actions');
  const [f, setF] = useState(EMPTY);
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<Page<ActionRow | ChangeRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const qs = () => {
    const p = new URLSearchParams({ type, skip: String(skip), take: String(TAKE) });
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    return p.toString();
  };
  const load = () => api<Page<ActionRow | ChangeRow>>('GET', `/admin/audit?${qs()}`).then((pg) => setPage({ ...pg, rows: pg.rows })).catch((e) => setError((e as Error).message));
  useEffect(() => { void load(); }, [type, skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <section>
      <h2>Audit log</h2>
      <p className="muted">
        Every request that changes something (and every admin view of personal data), and every change to the data itself
        with who made it. Passwords, codes and national ID numbers are never recorded.
      </p>
      <div className="tabs-inline">
        <button className={type === 'actions' ? 'on' : ''} onClick={() => { setPage(null); setType('actions'); setSkip(0); setF(EMPTY); }}>Actions</button>
        <button className={type === 'changes' ? 'on' : ''} onClick={() => { setPage(null); setType('changes'); setSkip(0); setF(EMPTY); }}>Data changes</button>
      </div>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setSkip(0); void load(); }}>
        <input placeholder="Broker slug" value={f.tenant} onChange={set('tenant')} aria-label="Broker" />
        <input placeholder="User email" value={f.actor} onChange={set('actor')} aria-label="User" />
        {type === 'actions' ? (
          <input placeholder="Action (e.g. deposits, login)" value={f.action} onChange={set('action')} aria-label="Action" />
        ) : (
          <select value={f.action} onChange={set('action')} aria-label="Operation">
            <option value="">Any change</option>
            {['INSERT', 'UPDATE', 'DELETE'].map((a) => <option key={a}>{a}</option>)}
          </select>
        )}
        <select value={f.entity} onChange={set('entity')} aria-label={type === 'actions' ? 'Entity' : 'Table'}>
          <option value="">{type === 'actions' ? 'Any entity' : 'Any table'}</option>
          {page?.facets.entities.map((e) => <option key={e}>{e}</option>)}
        </select>
        <input type="date" value={f.from} onChange={set('from')} aria-label="From" />
        <input type="date" value={f.to} onChange={set('to')} aria-label="To" />
        <input placeholder={type === 'actions' ? 'IP, id or text' : 'Row id'} value={f.text} onChange={set('text')} aria-label="Text" />
        <button className="primary">Filter</button>
        <button type="button" onClick={() => download(`/admin/audit/export?${qs()}`).catch((e) => setError((e as Error).message))}>Export CSV</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {page ? <p className="muted">{page.total.toLocaleString('en')} records</p> : null}

      {type === 'actions' ? (
        <table>
          <thead><tr><th>When</th><th>Broker</th><th>Who</th><th>Action</th><th>Result</th><th>IP · device</th></tr></thead>
          <tbody>
            {(page?.rows as ActionRow[] | undefined)?.map((r) => (
              <tr key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="clickable">
                <td className="nowrap">{when(r.createdAt)}</td>
                <td>{r.tenant ?? <span className="muted">platform</span>}</td>
                <td>{r.actor ?? (typeof r.data?.email === 'string' ? <span className="muted">{r.data.email} (not signed in)</span> : <span className="muted">anonymous</span>)}</td>
                <td>
                  <code>{r.action}</code>
                  {r.entity !== 'Request' ? <span className="muted"> · {r.entity}</span> : null}
                  {open === r.id ? <pre className="json">{JSON.stringify({ entityId: r.entityId, data: r.data, requestId: r.requestId, userAgent: r.userAgent }, null, 2)}</pre> : null}
                </td>
                <td>{r.outcome ? <span className={`badge ${r.outcome < 400 ? 'ok' : 'bad'}`}>{r.outcome}</span> : <span className="badge ok">recorded</span>}</td>
                <td className="nowrap">{r.ip ?? ''}{r.userAgent ? <><br /><span className="muted">{shortUa(r.userAgent)}</span></> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table>
          <thead><tr><th>When</th><th>Broker</th><th>Who</th><th>Change</th><th>Row</th><th>What changed</th></tr></thead>
          <tbody>
            {(page?.rows as ChangeRow[] | undefined)?.map((r) => (
              <tr key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="clickable">
                <td className="nowrap">{when(r.at)}</td>
                <td>{r.tenant ?? <span className="muted">platform</span>}</td>
                <td>{r.actor ?? <span className="muted">system</span>}</td>
                <td><span className={`badge ${r.op === 'DELETE' ? 'bad' : r.op === 'UPDATE' ? 'warn' : 'ok'}`}>{r.op}</span> {r.tableName}</td>
                <td className="mono small">{r.rowId}</td>
                <td>
                  {!r.changes ? null : r.op === 'UPDATE' ? (
                    <ul className="diff">
                      {Object.entries(r.changes).slice(0, open === r.id ? 50 : 3).map(([k, v]) => (
                        <li key={k}><strong>{k}</strong>: <del>{JSON.stringify((v as { from: unknown }).from)}</del> → <ins>{JSON.stringify((v as { to: unknown }).to)}</ins></li>
                      ))}
                    </ul>
                  ) : open === r.id ? (
                    <pre className="json">{JSON.stringify(r.changes, null, 2)}</pre>
                  ) : (
                    <span className="muted">{Object.keys(r.changes).length} fields · click to view</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="actions">
        <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - TAKE))}>Newer</button>
        <button disabled={!page || skip + TAKE >= page.total} onClick={() => setSkip(skip + TAKE)}>Older</button>
      </div>
    </section>
  );
}

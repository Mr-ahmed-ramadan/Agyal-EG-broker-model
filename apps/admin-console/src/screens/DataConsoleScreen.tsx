import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { when } from '../useLoad';

interface TableInfo { name: string; label: string; count: number }
interface RowsPage { table: string; total: number; skip: number; take: number; rows: Record<string, unknown>[] }
interface Hit { kind: string; id: string; title: string; subtitle: string }
interface TimelineItem { at: string; kind: 'ACTION' | 'DATA' | 'LEDGER' | 'FIX' | 'SIGN_IN'; title: string; detail?: unknown; actor?: string | null; ref?: string | null }
interface View360 {
  kind: string;
  title: string;
  summary: Record<string, unknown>;
  sections: Record<string, Record<string, unknown>[]>;
  links?: Record<string, { kind: string; id: string; title: string } | null>;
  timeline: TimelineItem[];
}

const TAKE = 25;
const KIND_LABEL: Record<TimelineItem['kind'], string> = { ACTION: 'Action', DATA: 'Data', LEDGER: 'Ledger', FIX: 'FIX', SIGN_IN: 'Sign-in' };

function cell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 16).replace('T', ' ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Grid({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="muted">None.</p>;
  const cols = Object.keys(rows[0]).filter((c) => rows.some((r) => r[c] !== undefined));
  return (
    <div className="grid-wrap">
      <table className="grid">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c} title={cell(r[c])}>{cell(r[c]).slice(0, 80)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only: browse every table, search anything and open a 360° view with a merged timeline. */
export function DataConsoleScreen() {
  const [mode, setMode] = useState<'search' | 'tables'>('search');
  return (
    <section>
      <h2>Data console</h2>
      <p className="muted">Read-only view of all platform data. Sensitive fields are masked; every view is itself recorded in the audit log.</p>
      <div className="tabs-inline">
        <button className={mode === 'search' ? 'on' : ''} onClick={() => setMode('search')}>360° search</button>
        <button className={mode === 'tables' ? 'on' : ''} onClick={() => setMode('tables')}>Tables</button>
      </div>
      {mode === 'search' ? <Search360 /> : <Tables />}
    </section>
  );
}

function Search360() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [view, setView] = useState<View360 | null>(null);
  const [kinds, setKinds] = useState<Set<TimelineItem['kind']>>(new Set(['ACTION', 'DATA', 'LEDGER', 'FIX', 'SIGN_IN']));
  const [error, setError] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setView(null);
    try {
      setHits(await api<Hit[]>('GET', `/admin/data/search?q=${encodeURIComponent(q)}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function openView(kind: string, id: string) {
    setError(null);
    try {
      setView(await api<View360>('GET', `/admin/data/360/${kind}/${encodeURIComponent(id)}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const toggle = (k: TimelineItem['kind']) => {
    const next = new Set(kinds);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setKinds(next);
  };

  return (
    <>
      <form className="filters" onSubmit={search}>
        <input className="wide" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client name, email, deposit reference, order id, ISIN or broker" aria-label="Search" />
        <button className="primary">Search</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {hits && !view ? (
        hits.length ? (
          <ul className="hits">
            {hits.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                <button className="link" onClick={() => openView(h.kind, h.id)}><strong>{h.title}</strong></button>
                <span className="muted"> {h.subtitle}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Nothing found.</p>
      ) : null}
      {view ? (
        <div className="v360">
          <div className="row">
            <h3>{view.title} <span className="badge">{view.kind}</span></h3>
            <button className="link" onClick={() => setView(null)}>Back to results</button>
          </div>
          {view.links ? (
            <p className="muted">
              {Object.values(view.links).filter(Boolean).map((l) => (
                <button key={l!.id} className="link chip-link" onClick={() => openView(l!.kind, l!.id)}>{l!.kind}: {l!.title}</button>
              ))}
            </p>
          ) : null}
          <div className="v360-grid">
            <div>
              <div className="card">
                <h4>Details</h4>
                <dl className="kv">
                  {Object.entries(view.summary).filter(([, v]) => v !== undefined).map(([k, v]) => (
                    <Fragment key={k}><dt>{k}</dt><dd>{cell(v)}</dd></Fragment>
                  ))}
                </dl>
              </div>
              {Object.entries(view.sections).map(([name, rows]) => (
                <div className="card" key={name}>
                  <h4>{name.replace(/([A-Z])/g, ' $1').toLowerCase()} <span className="muted">({rows.length})</span></h4>
                  {name === 'orders' || name === 'latestOrders' ? (
                    <ul className="plain">
                      {rows.map((r) => (
                        <li key={String(r.id)}>
                          <button className="link" onClick={() => openView('order', String(r.id))}>{cell(r.side)} {cell(r.isin ?? '')} {cell(r.qty)}</button>
                          <span className="muted"> · {cell(r.createdAt)} · status {cell(r.status)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <Grid rows={rows} />}
                </div>
              ))}
            </div>
            <div className="card">
              <h4>Timeline <span className="muted">({view.timeline.length})</span></h4>
              <div className="chips">
                {(Object.keys(KIND_LABEL) as TimelineItem['kind'][]).map((k) => (
                  <button key={k} className={`chip ${kinds.has(k) ? 'on' : ''}`} onClick={() => toggle(k)}>{KIND_LABEL[k]}</button>
                ))}
              </div>
              <ol className="timeline">
                {view.timeline.filter((t) => kinds.has(t.kind)).map((t, i) => (
                  <li key={i} className={`tl-${t.kind}`}>
                    <span className="tl-when">{when(t.at)}</span>
                    <span className={`badge tl-${t.kind}`}>{KIND_LABEL[t.kind]}</span> <strong>{t.title}</strong>
                    {t.actor ? <span className="muted"> · {t.actor}</span> : null}
                    {t.detail ? (
                      <details><summary className="muted">details</summary><pre className="json">{typeof t.detail === 'string' ? t.detail : JSON.stringify(t.detail, null, 2)}</pre></details>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Tables() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState<RowsPage | null>(null);
  const [skip, setSkip] = useState(0);
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TableInfo[]>('GET', '/admin/data/tables').then((t) => { setTables(t); setActive(t[0]?.name ?? null); }).catch((e) => setError((e as Error).message));
  }, []);
  const load = () => {
    if (!active) return;
    const p = new URLSearchParams({ skip: String(skip), take: String(TAKE) });
    if (field && value) { p.set('field', field); p.set('value', value); }
    api<RowsPage>('GET', `/admin/data/tables/${active}?${p}`).then(setPage).catch((e) => setError((e as Error).message));
  };
  useEffect(load, [active, skip]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tables-layout">
      <ul className="table-list">
        {tables.map((t) => (
          <li key={t.name}>
            <button className={active === t.name ? 'on' : ''} onClick={() => { setActive(t.name); setSkip(0); setField(''); setValue(''); setError(null); }}>
              {t.label} <span className="muted">{t.count.toLocaleString('en')}</span>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <form className="filters" onSubmit={(e) => { e.preventDefault(); setSkip(0); load(); }}>
          <select value={field} onChange={(e) => setField(e.target.value)} aria-label="Column">
            <option value="">Filter by column…</option>
            {page?.rows[0] ? Object.keys(page.rows[0]).map((c) => <option key={c}>{c}</option>) : null}
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="equals…" aria-label="Value" />
          <button>Filter</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
        {page ? (
          <>
            <p className="muted">{page.total.toLocaleString('en')} rows · showing {page.skip + 1}–{Math.min(page.skip + page.take, page.total)}</p>
            <Grid rows={page.rows} />
            <div className="actions">
              <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - TAKE))}>Previous</button>
              <button disabled={skip + TAKE >= page.total} onClick={() => setSkip(skip + TAKE)}>Next</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

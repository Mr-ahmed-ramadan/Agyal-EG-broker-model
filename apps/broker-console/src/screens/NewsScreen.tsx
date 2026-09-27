import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad, when } from '../useLoad';

interface News {
  id: string;
  tenantId: string | null;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  publishedAt: string;
}

const EMPTY = { titleEn: '', titleAr: '', bodyEn: '', bodyAr: '' };

/** News shown on the client home page (English and Arabic). */
export function NewsScreen() {
  const { data, error, reload } = useLoad<News[]>('/broker/news');
  const [f, setF] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api('POST', '/broker/news', f);
      setF(EMPTY);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this news item?')) return;
    await api('DELETE', `/broker/news/${id}`);
    reload();
  }

  return (
    <section>
      <h2>News</h2>
      <p className="muted">Your news appears on your clients' home page, together with platform news from Agyal.</p>
      {error ? <p className="error">{error}</p> : null}
      <form className="card fields" onSubmit={submit}>
        <label>Title (English)<input value={f.titleEn} onChange={set('titleEn')} required minLength={3} maxLength={140} /></label>
        <label>Title (Arabic)<input value={f.titleAr} onChange={set('titleAr')} required minLength={3} maxLength={140} dir="rtl" /></label>
        <label>Text (English)<textarea value={f.bodyEn} onChange={set('bodyEn')} required minLength={3} maxLength={2000} rows={3} /></label>
        <label>Text (Arabic)<textarea value={f.bodyAr} onChange={set('bodyAr')} required minLength={3} maxLength={2000} rows={3} dir="rtl" /></label>
        <button className="primary">Publish</button>
        {formError ? <p className="error">{formError}</p> : null}
      </form>
      <table>
        <thead><tr><th>Published</th><th>Title</th><th>Text</th><th></th></tr></thead>
        <tbody>
          {data?.map((n) => (
            <tr key={n.id}>
              <td>{when(n.publishedAt)}</td>
              <td>{n.titleEn}<br /><span dir="rtl" className="muted">{n.titleAr}</span></td>
              <td>{n.bodyEn}</td>
              <td>{n.tenantId ? <button className="link" onClick={() => remove(n.id)}>Remove</button> : <span className="muted">Agyal</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

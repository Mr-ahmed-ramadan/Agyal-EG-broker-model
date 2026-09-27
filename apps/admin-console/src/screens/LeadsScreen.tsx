import { useLoad, when } from '../useLoad';

interface Lead {
  id: string;
  name: string;
  firm: string;
  role: string | null;
  email: string;
  mobile: string | null;
  message: string | null;
  emailedAt: string | null;
  error: string | null;
  createdAt: string;
}

export function LeadsScreen() {
  const { data, error } = useLoad<Lead[]>('/admin/leads');
  return (
    <section>
      <h2>Leads</h2>
      <p className="muted">Brokers who contacted you from the landing page. Each one is also emailed to you.</p>
      {error ? <p className="error">{error}</p> : null}
      {data?.length === 0 ? <p className="muted">No leads yet.</p> : null}
      {data?.map((l) => (
        <div key={l.id} className="card">
          <div className="row">
            <strong>{l.firm}</strong>
            <span className="muted">{when(l.createdAt)}</span>
          </div>
          <p>
            {l.name}{l.role ? `, ${l.role}` : ''} · <a href={`mailto:${l.email}`}>{l.email}</a>
            {l.mobile ? <> · <a href={`tel:${l.mobile.replace(/\s/g, '')}`}>{l.mobile}</a></> : null}
          </p>
          {l.message ? <p className="quote">{l.message}</p> : null}
          {l.error ? <p className="error">Email to you failed: {l.error}</p> : null}
        </div>
      ))}
    </section>
  );
}

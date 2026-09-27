import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad, when } from '../useLoad';

interface Tenant {
  id: string;
  slug: string;
  legalNameEn: string;
  legalNameAr: string;
  fraLicenseNo: string | null;
  status: string;
  customDomain: string | null;
  createdAt: string;
  branding: { displayName: { en: string; ar: string }; colors: { primary: string } };
}

export function BrokersScreen() {
  const { data, error, reload } = useLoad<Tenant[]>('/admin/tenants');
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const current = data?.find((t) => t.slug === selected);

  return (
    <section>
      <div className="row">
        <h2>Brokers</h2>
        <button className="primary" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add broker'}</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {adding ? <AddBroker onDone={(slug) => { setAdding(false); setSelected(slug); reload(); }} /> : null}
      <table>
        <thead><tr><th>Broker</th><th>Slug</th><th>FRA licence</th><th>Domain</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          {data?.map((t) => (
            <tr key={t.id} className={t.slug === selected ? 'selected' : ''} onClick={() => setSelected(t.slug)} style={{ cursor: 'pointer' }}>
              <td>
                <span className="swatch" style={{ background: t.branding.colors.primary }} /> {t.branding.displayName.en}
                <div className="muted" dir="rtl">{t.branding.displayName.ar}</div>
              </td>
              <td className="mono">{t.slug}</td>
              <td>{t.fraLicenseNo ?? '-'}</td>
              <td>{t.customDomain ?? '-'}</td>
              <td>{t.status}</td>
              <td>{when(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {current ? <BrokerDetail key={current.slug} tenant={current} /> : <p className="muted">Select a broker to manage its staff and bank links.</p>}
    </section>
  );
}

function AddBroker({ onDone }: { onDone: (slug: string) => void }) {
  const [f, setF] = useState({
    slug: '', legalNameEn: '', legalNameAr: '', fraLicenseNo: '', customDomain: '',
    nameEn: '', nameAr: '', primary: '#0b4f6c', primaryContrast: '#ffffff', accent: '#c28f2c',
    supportEmail: '', termsUrl: '', riskDisclosureUrl: '', privacyUrl: '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('POST', '/admin/tenants', {
        slug: f.slug,
        legalNameEn: f.legalNameEn,
        legalNameAr: f.legalNameAr,
        fraLicenseNo: f.fraLicenseNo || undefined,
        customDomain: f.customDomain || undefined,
        branding: {
          displayName: { en: f.nameEn, ar: f.nameAr },
          logoUrl: '',
          colors: { primary: f.primary, primaryContrast: f.primaryContrast, accent: f.accent },
          supportEmail: f.supportEmail,
          legalDocuments: { termsUrl: f.termsUrl || '#', riskDisclosureUrl: f.riskDisclosureUrl || '#', privacyUrl: f.privacyUrl || '#' },
        },
      });
      onDone(f.slug);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="card fields" onSubmit={submit}>
      <label>Slug (used in links)<input value={f.slug} onChange={set('slug')} required placeholder="brokerx" /></label>
      <label>Legal name (English)<input value={f.legalNameEn} onChange={set('legalNameEn')} required /></label>
      <label>Legal name (Arabic)<input value={f.legalNameAr} onChange={set('legalNameAr')} required dir="rtl" /></label>
      <label>FRA licence no.<input value={f.fraLicenseNo} onChange={set('fraLicenseNo')} /></label>
      <label>App name (English)<input value={f.nameEn} onChange={set('nameEn')} required /></label>
      <label>App name (Arabic)<input value={f.nameAr} onChange={set('nameAr')} required dir="rtl" /></label>
      <label>Primary colour<input type="color" value={f.primary} onChange={set('primary')} /></label>
      <label>Text on primary<input type="color" value={f.primaryContrast} onChange={set('primaryContrast')} /></label>
      <label>Accent colour<input type="color" value={f.accent} onChange={set('accent')} /></label>
      <label>Support email<input type="email" value={f.supportEmail} onChange={set('supportEmail')} required /></label>
      <label>Custom domain (optional)<input value={f.customDomain} onChange={set('customDomain')} placeholder="invest.brokerx.com.eg" /></label>
      <label>Terms URL<input value={f.termsUrl} onChange={set('termsUrl')} /></label>
      <label>Risk disclosure URL<input value={f.riskDisclosureUrl} onChange={set('riskDisclosureUrl')} /></label>
      <label>Privacy notice URL<input value={f.privacyUrl} onChange={set('privacyUrl')} /></label>
      <button className="primary">Create broker</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

const ROLES = ['BROKER_ADMIN', 'BROKER_COMPLIANCE', 'BROKER_OPS', 'BROKER_FINANCE', 'BROKER_DEALER'];

interface Staff { id: string; email: string; mobile: string | null; roles: string[]; mobileVerified: boolean }
interface BankLink { bankCode: string; bankName: string; connectionMode: string; brokerAccountAtBank: string; active: boolean }
interface Bank { code: string; nameEn: string; connectionMode: string }

function BrokerDetail({ tenant }: { tenant: Tenant }) {
  const staff = useLoad<Staff[]>(`/admin/tenants/${tenant.slug}/staff`);
  const links = useLoad<BankLink[]>(`/admin/tenants/${tenant.slug}/banks`);
  const banks = useLoad<Bank[]>('/admin/banks');
  const [s, setS] = useState({ email: '', mobile: '', password: '', roles: [] as string[] });
  const [b, setB] = useState({ bankCode: '', brokerAccountAtBank: '' });
  const [error, setError] = useState<string | null>(null);

  async function addStaff(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('POST', `/admin/tenants/${tenant.slug}/staff`, s);
      setS({ email: '', mobile: '', password: '', roles: [] });
      staff.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function linkBank(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('POST', `/admin/tenants/${tenant.slug}/banks`, b);
      setB({ bankCode: '', brokerAccountAtBank: '' });
      links.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="card">
      <h2>{tenant.legalNameEn}</h2>
      {error ? <p className="error">{error}</p> : null}

      <h3>Staff</h3>
      <table>
        <thead><tr><th>Email</th><th>Mobile</th><th>Roles</th><th>Mobile verified</th></tr></thead>
        <tbody>
          {staff.data?.map((u) => (
            <tr key={u.id}><td>{u.email}</td><td className="mono">{u.mobile}</td><td>{u.roles.join(', ')}</td><td>{u.mobileVerified ? 'Yes' : 'On first sign-in'}</td></tr>
          ))}
        </tbody>
      </table>
      <form className="fields" onSubmit={addStaff}>
        <label>Email<input type="email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} required /></label>
        <label>Mobile<input value={s.mobile} onChange={(e) => setS({ ...s, mobile: e.target.value })} required placeholder="01012345678" /></label>
        <label>Initial password (10+ characters)<input type="password" value={s.password} onChange={(e) => setS({ ...s, password: e.target.value })} required minLength={10} /></label>
        <fieldset>
          <legend>Roles</legend>
          {ROLES.map((r) => (
            <label key={r} className="check">
              <input type="checkbox" checked={s.roles.includes(r)} onChange={(e) => setS({ ...s, roles: e.target.checked ? [...s.roles, r] : s.roles.filter((x) => x !== r) })} />
              {r.replace('BROKER_', '').toLowerCase()}
            </label>
          ))}
        </fieldset>
        <button className="primary" disabled={s.roles.length === 0}>Add staff member</button>
      </form>

      <h3>Partner banks</h3>
      <table>
        <thead><tr><th>Bank</th><th>Connection</th><th>Broker account at bank</th><th>Active</th></tr></thead>
        <tbody>
          {links.data?.map((l) => (
            <tr key={l.bankCode}><td>{l.bankName}</td><td>{l.connectionMode}</td><td className="mono">{l.brokerAccountAtBank}</td><td>{l.active ? 'Yes' : 'No'}</td></tr>
          ))}
        </tbody>
      </table>
      <form className="fields" onSubmit={linkBank}>
        <label>
          Bank
          <select value={b.bankCode} onChange={(e) => setB({ ...b, bankCode: e.target.value })} required>
            <option value="">Choose…</option>
            {banks.data?.map((bk) => <option key={bk.code} value={bk.code}>{bk.nameEn} ({bk.connectionMode})</option>)}
          </select>
        </label>
        <label>Broker&apos;s account at this bank<input value={b.brokerAccountAtBank} onChange={(e) => setB({ ...b, brokerAccountAtBank: e.target.value })} required /></label>
        <button className="primary">Link bank</button>
      </form>
    </div>
  );
}

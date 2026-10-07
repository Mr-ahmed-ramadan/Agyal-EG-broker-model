import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad, when } from '../useLoad';

const ROLES = ['BROKER_ADMIN', 'BROKER_COMPLIANCE', 'BROKER_OPS', 'BROKER_FINANCE', 'BROKER_DEALER'];
const STATUSES = ['ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'ok',
  ONBOARDING: 'warn',
  SUSPENDED: 'bad',
  OFFBOARDED: 'mute',
};

interface Tenant {
  id: string;
  slug: string;
  kind: 'BROKER' | 'PROSPECT_DEMO';
  legalNameEn: string;
  legalNameAr: string;
  fraLicenseNo: string | null;
  status: Status;
  customDomain: string | null;
  createdAt: string;
  branding: {
    displayName: { en: string; ar: string };
    logoUrl: string;
    colors: { primary: string; primaryContrast: string; accent: string };
    supportEmail: string;
    legalDocuments: { termsUrl: string; riskDisclosureUrl: string; privacyUrl: string };
  };
  counts: { users: number; clients: number; orders: number };
  links: { clientApp: string; brokerConsole: string };
  credentials?: { email: string; temporaryPassword: string };
}

/** Shrinks an uploaded logo to at most 256 px and returns a PNG data URL. */
function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 256 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

/** Same rule as the API: white or near-black text, whichever contrasts more. */
function textOn(hex: string): string {
  const ch = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0556 ? '#ffffff' : '#111111';
}

function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy">
      <span className="muted">{label}</span>
      <a href={url} target="_blank" rel="noreferrer" className="mono">{url}</a>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** A temporary password is shown once and never again; make that obvious. */
function Secret({ email, password }: { email: string; password: string }) {
  return (
    <p>
      Sign in as <strong>{email}</strong> with temporary password <code>{password}</code>.
      <br />
      <span className="muted">Shown once. Sign-in codes go to that email.</span>
    </p>
  );
}

/**
 * Brokers and prospect demos are the same row with a different `kind`, and the
 * list endpoint always returned both, so showing them in two tabs meant the
 * same tenant appeared twice with no way to tell which was which. One tab,
 * labelled, with the create/edit/suspend/delete actions the job actually needs.
 */
export function BrokersScreen() {
  const [filter, setFilter] = useState({ kind: '', status: '', q: '' });
  const qs = () => {
    const p = new URLSearchParams();
    if (filter.kind) p.set('kind', filter.kind);
    if (filter.status) p.set('status', filter.status);
    if (filter.q) p.set('q', filter.q);
    return p.toString();
  };
  const path = useMemo(() => `/admin/tenants${qs() ? `?${qs()}` : ''}`, [filter.kind, filter.status, filter.q]);
  const { data, error, reload } = useLoad<Tenant[]>(path);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const current = data?.find((t) => t.slug === selected) ?? null;

  return (
    <section>
      <div className="row">
        <h2>Brokers &amp; demos</h2>
        <button className="primary" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add'}</button>
      </div>
      <p className="muted">
        Every tenant on the platform. A prospect demo is the same thing as a broker with simulated
        banks behind it, so they live in one list.
      </p>
      {error ? <p className="error">{error}</p> : null}

      {adding ? (
        <AddTenant
          brokers={data ?? []}
          onCreated={(slug) => { setSelected(slug); reload(); }}
          onClose={() => setAdding(false)}
        />
      ) : null}

      <div className="filters">
        <button className={filter.kind === 'BROKER' ? 'on' : ''} onClick={() => setFilter({ ...filter, kind: filter.kind === 'BROKER' ? '' : 'BROKER' })}>
          Brokers
        </button>
        <button className={filter.kind === 'PROSPECT_DEMO' ? 'on' : ''} onClick={() => setFilter({ ...filter, kind: filter.kind === 'PROSPECT_DEMO' ? '' : 'PROSPECT_DEMO' })}>
          Prospect demos
        </button>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <input placeholder="Search name or slug" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
      </div>

      <table>
        <thead>
          <tr><th>Name</th><th>Kind</th><th>Slug</th><th>Status</th><th className="num">Staff</th><th className="num">Clients</th><th>Created</th></tr>
        </thead>
        <tbody>
          {data?.map((t) => (
            <tr key={t.id} className={t.slug === selected ? 'selected' : ''} onClick={() => setSelected(t.slug)} style={{ cursor: 'pointer' }}>
              <td>
                <span className="swatch" style={{ background: t.branding.colors.primary }} /> {t.branding.displayName.en}
                <div className="muted" dir="rtl">{t.branding.displayName.ar}</div>
              </td>
              <td><span className={`badge ${t.kind === 'BROKER' ? '' : 'warn'}`}>{t.kind === 'BROKER' ? 'Broker' : 'Demo'}</span></td>
              <td className="mono">{t.slug}</td>
              <td><span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status.toLowerCase()}</span></td>
              <td className="num">{t.counts.users}</td>
              <td className="num">{t.counts.clients}</td>
              <td>{when(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data?.length === 0 ? <p className="muted">Nothing matches that filter.</p> : null}

      {current ? (
        <TenantDetail key={current.slug} tenant={current} onChanged={reload} onDeleted={() => { setSelected(null); reload(); }} />
      ) : (
        <p className="muted">Select one to edit it, manage its staff and link banks.</p>
      )}
    </section>
  );
}

// --- create ------------------------------------------------------------------

function AddTenant({ brokers, onCreated, onClose }: { brokers: Tenant[]; onCreated: (slug: string) => void; onClose: () => void }) {
  const [f, setF] = useState({
    kind: 'BROKER' as 'BROKER' | 'PROSPECT_DEMO',
    legalNameEn: '', legalNameAr: '', nameEn: '', nameAr: '',
    slug: '', fraLicenseNo: '', customDomain: '',
    primary: '#2f5a45', accent: '#a8823a', supportEmail: '',
    copyBanksFrom: '', email: '', mobile: '',
  });
  const [logo, setLogo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Tenant | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function pickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return setLogo('');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError('Use a PNG, JPEG or WebP logo');
    try {
      setLogo(await resizeLogo(file));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const nameEn = f.nameEn || f.legalNameEn;
    const nameAr = f.nameAr || f.legalNameAr;
    try {
      const t = await api<Tenant>('POST', '/admin/tenants', {
        kind: f.kind,
        slug: f.slug || undefined,
        legalNameEn: f.legalNameEn,
        legalNameAr: f.legalNameAr,
        fraLicenseNo: f.fraLicenseNo || undefined,
        customDomain: f.customDomain || undefined,
        branding: {
          displayName: { en: nameEn, ar: nameAr },
          logoUrl: logo,
          colors: { primary: f.primary, primaryContrast: textOn(f.primary), accent: f.accent },
          supportEmail: f.supportEmail || 'support@agyal.net',
          legalDocuments: { termsUrl: '#', riskDisclosureUrl: '#', privacyUrl: '#' },
        },
        copyBanksFrom: f.copyBanksFrom || undefined,
        login: f.email ? { email: f.email, mobile: f.mobile } : undefined,
      });
      setCreated(t);
      onCreated(t.slug);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="card highlight">
        <h3>{created.branding.displayName.en} is ready</h3>
        <CopyLink label="Client app" url={created.links.clientApp} />
        <CopyLink label="Broker console" url={created.links.brokerConsole} />
        {created.credentials ? <Secret email={created.credentials.email} password={created.credentials.temporaryPassword} /> : null}
        <div className="actions"><button className="primary" onClick={onClose}>Done</button></div>
      </div>
    );
  }

  return (
    <form className="card fields" onSubmit={submit}>
      <fieldset>
        <legend>What are you creating?</legend>
        <label className="check">
          <input type="radio" checked={f.kind === 'BROKER'} onChange={() => setF({ ...f, kind: 'BROKER' })} /> A broker
        </label>
        <label className="check">
          <input type="radio" checked={f.kind === 'PROSPECT_DEMO'} onChange={() => setF({ ...f, kind: 'PROSPECT_DEMO' })} /> A prospect demo
        </label>
      </fieldset>

      <label>Legal name (English)<input value={f.legalNameEn} onChange={set('legalNameEn')} required placeholder="e.g. Nile Capital Securities" /></label>
      <label>Legal name (Arabic)<input value={f.legalNameAr} onChange={set('legalNameAr')} required dir="rtl" /></label>
      <label>Display name (English, optional)<input value={f.nameEn} onChange={set('nameEn')} placeholder={f.legalNameEn || 'Same as legal name'} /></label>
      <label>Display name (Arabic, optional)<input value={f.nameAr} onChange={set('nameAr')} dir="rtl" placeholder={f.legalNameAr || 'نفس الاسم القانوني'} /></label>
      <label>
        Slug (optional)
        <input value={f.slug} onChange={set('slug')} placeholder={f.legalNameEn ? 'Generated from the name' : 'nile-capital'} pattern="[a-z0-9-]{3,40}" />
      </label>

      {f.kind === 'BROKER' ? (
        <>
          <label>FRA licence number<input value={f.fraLicenseNo} onChange={set('fraLicenseNo')} /></label>
          <label>Custom domain (optional)<input value={f.customDomain} onChange={set('customDomain')} placeholder="invest.brokerx.com.eg" /></label>
          <label>Support email<input type="email" value={f.supportEmail} onChange={set('supportEmail')} /></label>
        </>
      ) : null}

      <label>Logo (PNG, JPEG or WebP)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} /></label>
      <div className="preview" style={{ background: f.primary }}>
        {logo ? <img src={logo} alt="Logo preview" /> : null}
        <span style={{ color: textOn(f.primary), fontWeight: 600 }}>{f.nameEn || f.legalNameEn || 'Preview'}</span>
      </div>
      <label>Brand colour<input type="color" value={f.primary} onChange={set('primary')} /></label>
      <label>Accent colour<input type="color" value={f.accent} onChange={set('accent')} /></label>

      <label>
        Copy partner banks from
        <select value={f.copyBanksFrom} onChange={set('copyBanksFrom')}>
          <option value="">Don&apos;t copy — link banks later</option>
          {brokers.map((b) => <option key={b.slug} value={b.slug}>{b.branding.displayName.en} ({b.slug})</option>)}
        </select>
      </label>

      <label>First login email (optional)<input type="email" value={f.email} onChange={set('email')} /></label>
      <label>Their mobile{f.email ? '' : ' (with email)'}<input value={f.mobile} onChange={set('mobile')} required={Boolean(f.email)} placeholder="01012345678" /></label>

      <button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

// --- detail ------------------------------------------------------------------

interface Staff { id: string; email: string; mobile: string | null; roles: string[]; mobileVerified: boolean; disabled: boolean }
interface BankLink { bankCode: string; bankName: string; connectionMode: string; brokerAccountAtBank: string; active: boolean }
interface Bank { code: string; nameEn: string; connectionMode: string }

function TenantDetail({ tenant, onChanged, onDeleted }: { tenant: Tenant; onChanged: () => void; onDeleted: () => void }) {
  const staff = useLoad<Staff[]>(`/admin/tenants/${tenant.slug}/staff`);
  const links = useLoad<BankLink[]>(`/admin/tenants/${tenant.slug}/banks`);
  const banks = useLoad<Bank[]>('/admin/banks');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  const [edit, setEdit] = useState({
    legalNameEn: tenant.legalNameEn,
    legalNameAr: tenant.legalNameAr,
    fraLicenseNo: tenant.fraLicenseNo ?? '',
    customDomain: tenant.customDomain ?? '',
    en: tenant.branding.displayName.en,
    ar: tenant.branding.displayName.ar,
    primary: tenant.branding.colors.primary,
    accent: tenant.branding.colors.accent,
    supportEmail: tenant.branding.supportEmail,
  });
  const [s, setS] = useState({ email: '', mobile: '', roles: [] as string[] });
  const [b, setB] = useState({ bankCode: '', brokerAccountAtBank: '' });

  const guard = (fn: () => Promise<void>) => async () => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const save = guard(async () => {
    await api('PATCH', `/admin/tenants/${tenant.slug}`, {
      legalNameEn: edit.legalNameEn,
      legalNameAr: edit.legalNameAr,
      fraLicenseNo: edit.fraLicenseNo || null,
      customDomain: edit.customDomain || null,
      branding: {
        displayName: { en: edit.en, ar: edit.ar },
        colors: { primary: edit.primary, primaryContrast: textOn(edit.primary), accent: edit.accent },
        supportEmail: edit.supportEmail,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onChanged();
  });

  const setStatus = (status: Status) => guard(async () => {
    await api('PATCH', `/admin/tenants/${tenant.slug}`, { status });
    onChanged();
  })();

  const remove = guard(async () => {
    if (!window.confirm(`Delete the demo "${tenant.branding.displayName.en}" and its logins? This cannot be undone.`)) return;
    await api('DELETE', `/admin/tenants/${tenant.slug}`);
    onDeleted();
  });

  const addStaff = async (e: FormEvent) => {
    e.preventDefault();
    await guard(async () => {
      const r = await api<{ email: string; temporaryPassword?: string }>('POST', `/admin/tenants/${tenant.slug}/staff`, s);
      if (r.temporaryPassword) setSecret({ email: r.email, password: r.temporaryPassword });
      setS({ email: '', mobile: '', roles: [] });
      staff.reload();
      onChanged();
    })();
  };

  const resetPassword = (u: Staff) => guard(async () => {
    const r = await api<{ temporaryPassword?: string }>('PATCH', `/admin/tenants/${tenant.slug}/staff/${u.id}`, { resetPassword: true });
    if (r.temporaryPassword) setSecret({ email: u.email, password: r.temporaryPassword });
  })();

  const toggleRole = (u: Staff, role: string) => guard(async () => {
    const roles = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    if (roles.length === 0) throw new Error('A staff member needs at least one role');
    await api('PATCH', `/admin/tenants/${tenant.slug}/staff/${u.id}`, { roles });
    staff.reload();
  })();

  const toggleDisabled = (u: Staff) => guard(async () => {
    await api('POST', `/admin/tenants/${tenant.slug}/staff/${u.id}/${u.disabled ? 'enable' : 'disable'}`);
    staff.reload();
  })();

  const linkBank = async (e: FormEvent) => {
    e.preventDefault();
    await guard(async () => {
      await api('POST', `/admin/tenants/${tenant.slug}/banks`, b);
      setB({ bankCode: '', brokerAccountAtBank: '' });
      links.reload();
    })();
  };

  const deletable = tenant.kind === 'PROSPECT_DEMO' && tenant.counts.clients === 0 && tenant.counts.orders === 0;

  return (
    <div className="card">
      <div className="row">
        <h2>
          <span className="swatch" style={{ background: tenant.branding.colors.primary }} /> {tenant.branding.displayName.en}
          {' '}<span className={`badge ${tenant.kind === 'BROKER' ? '' : 'warn'}`}>{tenant.kind === 'BROKER' ? 'Broker' : 'Demo'}</span>
          {' '}<span className={`badge ${STATUS_BADGE[tenant.status]}`}>{tenant.status.toLowerCase()}</span>
        </h2>
        <span className="muted mono">{tenant.slug}</span>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {secret ? <div className="card highlight"><Secret email={secret.email} password={secret.password} /></div> : null}

      <CopyLink label="Client app" url={tenant.links.clientApp} />
      <CopyLink label="Broker console" url={tenant.links.brokerConsole} />

      <h3>Details</h3>
      <div className="fields">
        <label>Legal name (English)<input value={edit.legalNameEn} onChange={(e) => setEdit({ ...edit, legalNameEn: e.target.value })} /></label>
        <label>Legal name (Arabic)<input value={edit.legalNameAr} onChange={(e) => setEdit({ ...edit, legalNameAr: e.target.value })} dir="rtl" /></label>
        <label>Display name (English)<input value={edit.en} onChange={(e) => setEdit({ ...edit, en: e.target.value })} /></label>
        <label>Display name (Arabic)<input value={edit.ar} onChange={(e) => setEdit({ ...edit, ar: e.target.value })} dir="rtl" /></label>
        <label>FRA licence<input value={edit.fraLicenseNo} onChange={(e) => setEdit({ ...edit, fraLicenseNo: e.target.value })} /></label>
        <label>Custom domain<input value={edit.customDomain} onChange={(e) => setEdit({ ...edit, customDomain: e.target.value })} placeholder="invest.brokerx.com.eg" /></label>
        <label>Support email<input type="email" value={edit.supportEmail} onChange={(e) => setEdit({ ...edit, supportEmail: e.target.value })} /></label>
        <label>Brand colour<input type="color" value={edit.primary} onChange={(e) => setEdit({ ...edit, primary: e.target.value })} /></label>
        <label>Accent colour<input type="color" value={edit.accent} onChange={(e) => setEdit({ ...edit, accent: e.target.value })} /></label>
        <div className="actions">
          <button className="primary" onClick={save}>{saved ? 'Saved' : 'Save changes'}</button>
        </div>
      </div>

      <h3>Status</h3>
      <div className="actions">
        {STATUSES.filter((st) => st !== tenant.status).map((st) => (
          <button key={st} onClick={() => setStatus(st)}>{st === 'ACTIVE' ? 'Activate' : st.toLowerCase()}</button>
        ))}
        {deletable ? <button className="danger" onClick={remove}>Delete demo</button> : null}
      </div>
      {!deletable && tenant.kind === 'PROSPECT_DEMO' ? (
        <p className="muted">
          This demo has {tenant.counts.clients} client(s) and {tenant.counts.orders} order(s), so it keeps a ledger.
          Offboard it rather than deleting it.
        </p>
      ) : null}

      <h3>Staff</h3>
      <table>
        <thead><tr><th>Email</th><th>Mobile</th><th>Roles</th><th>Mobile verified</th><th></th></tr></thead>
        <tbody>
          {staff.data?.map((u) => (
            <tr key={u.id} style={u.disabled ? { opacity: 0.55 } : undefined}>
              <td>
                {u.email}
                {u.disabled ? <> <span className="badge bad">Disabled</span></> : null}
              </td>
              <td className="mono">{u.mobile}</td>
              <td>
                <div className="filters">
                  {ROLES.map((r) => (
                    <button key={r} className={u.roles.includes(r) ? 'on' : ''} onClick={() => toggleRole(u, r)} title="Click to add or remove">
                      {r.replace('BROKER_', '').toLowerCase()}
                    </button>
                  ))}
                </div>
              </td>
              <td>{u.mobileVerified ? 'Yes' : 'On first sign-in'}</td>
              <td>
                <div className="inline">
                  <button onClick={() => resetPassword(u)}>Reset password</button>
                  <button className={u.disabled ? '' : 'danger'} onClick={() => toggleDisabled(u)}>{u.disabled ? 'Enable' : 'Disable'}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="fields" onSubmit={addStaff}>
        <label>Email<input type="email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} required /></label>
        <label>Mobile<input value={s.mobile} onChange={(e) => setS({ ...s, mobile: e.target.value })} required placeholder="01012345678" /></label>
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
        <p className="muted">A temporary password is generated and shown once.</p>
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

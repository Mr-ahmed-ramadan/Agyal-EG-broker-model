import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad, when } from '../useLoad';

interface Prospect {
  slug: string;
  nameEn: string;
  nameAr: string;
  primary: string;
  hasLogo: boolean;
  createdAt: string;
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

export function ProspectsScreen() {
  const { data, error, reload } = useLoad<Prospect[]>('/admin/prospects');
  const [f, setF] = useState({ nameEn: '', nameAr: '', primary: '#2f5a45', accent: '#a8823a', email: '', mobile: '' });
  const [logo, setLogo] = useState<string | undefined>();
  const [created, setCreated] = useState<Prospect | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function pickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFormError(null);
    if (!file) return setLogo(undefined);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setFormError('Use a PNG, JPEG or WebP logo');
    try {
      setLogo(await resizeLogo(file));
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const p = await api<Prospect>('POST', '/admin/prospects', {
        nameEn: f.nameEn,
        nameAr: f.nameAr,
        primary: f.primary,
        accent: f.accent,
        logoDataUrl: logo,
        login: f.email ? { email: f.email, mobile: f.mobile } : undefined,
      });
      setCreated(p);
      setF({ ...f, nameEn: '', nameAr: '', email: '', mobile: '' });
      setLogo(undefined);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Prospect demos</h2>
      <p className="muted">
        Create a demo in a prospect broker&apos;s own name, logo and colours, then send them the links. It uses the
        simulated banks and demo instruments, so prices and trades work immediately.
      </p>

      <form className="card fields" onSubmit={submit}>
        <label>Firm name (English)<input value={f.nameEn} onChange={set('nameEn')} required placeholder="e.g. Nile Capital" /></label>
        <label>Firm name (Arabic)<input value={f.nameAr} onChange={set('nameAr')} required dir="rtl" placeholder="النيل كابيتال" /></label>
        <label>Logo (PNG, JPEG or WebP)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} /></label>
        <div className="preview" style={{ background: f.primary }}>
          {logo ? <img src={logo} alt="Logo preview" /> : null}
          <span style={{ color: textOn(f.primary), fontWeight: 600 }}>{f.nameEn || 'Preview'}</span>
        </div>
        <label>Brand colour<input type="color" value={f.primary} onChange={set('primary')} /></label>
        <label>Accent colour<input type="color" value={f.accent} onChange={set('accent')} /></label>
        <label>Prospect&apos;s email for a broker-console login (optional)<input type="email" value={f.email} onChange={set('email')} /></label>
        <label>Their mobile{f.email ? '' : ' (with email)'}<input value={f.mobile} onChange={set('mobile')} required={Boolean(f.email)} placeholder="01012345678" /></label>
        <button className="primary" disabled={busy}>Create demo</button>
        {formError ? <p className="error">{formError}</p> : null}
      </form>

      {created ? (
        <div className="card highlight">
          <h3>Demo ready for {created.nameEn}</h3>
          <CopyLink label="Client app (send this)" url={created.links.clientApp} />
          <CopyLink label="Broker console" url={created.links.brokerConsole} />
          {created.credentials ? (
            <p>
              Broker-console login: <strong>{created.credentials.email}</strong> / temporary password{' '}
              <code>{created.credentials.temporaryPassword}</code> (shown once; sign-in codes go to that email).
            </p>
          ) : null}
        </div>
      ) : null}

      <h3>Existing demos</h3>
      {error ? <p className="error">{error}</p> : null}
      {data?.length === 0 ? <p className="muted">No prospect demos yet.</p> : null}
      {data?.map((p) => (
        <div key={p.slug} className="card">
          <div className="row">
            <strong><span className="swatch" style={{ background: p.primary }} /> {p.nameEn} <span dir="rtl" className="muted">{p.nameAr}</span></strong>
            <span className="muted">{when(p.createdAt)}</span>
          </div>
          <CopyLink label="Client app" url={p.links.clientApp} />
          <CopyLink label="Broker console" url={p.links.brokerConsole} />
        </div>
      ))}
    </section>
  );
}

import { useState, type FormEvent, type ReactNode } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';

export interface OnboardingStatus {
  clientStatus: 'ONBOARDING' | 'PENDING_APPROVAL' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  completedSteps: string[];
  remainingSteps: string[];
  decisionNote: string | null;
  investorCode: { status?: string; code?: string | null };
  custodyReady: boolean;
  riskProfile: string | null;
  depositReference: string;
}

const STEPS = ['IDENTITY', 'PROFILE', 'SUITABILITY', 'UNIFIED_CODE', 'CONSENTS'] as const;
type Step = (typeof STEPS)[number];

export function OnboardingPage({ status, onChange }: { status: OnboardingStatus; onChange: () => void }) {
  const { t } = useApp();
  const [editing, setEditing] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const step: Step | undefined = editing ?? (status.remainingSteps[0] as Step | undefined);
  const inReview = status.clientStatus === 'PENDING_APPROVAL' || status.clientStatus === 'REJECTED';

  async function send(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api('POST', path, body);
      setEditing(null);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1>{t('onboardingTitle')}</h1>
      <ol className="stepper">
        {STEPS.map((s) => (
          <li key={s} className={status.completedSteps.includes(s) ? 'done' : s === step ? 'current' : ''}>
            <button className="link" disabled={inReview} onClick={() => setEditing(s)}>
              {t(`step_${s}`)}
            </button>
          </li>
        ))}
      </ol>

      {status.clientStatus === 'PENDING_APPROVAL' ? <p className="banner">{t('status_PENDING_APPROVAL')}</p> : null}
      {status.clientStatus === 'REJECTED' ? <p className="banner error">{t('status_REJECTED')}</p> : null}
      {status.clientStatus === 'NEEDS_INFO' ? (
        <p className="banner">
          {t('status_NEEDS_INFO')} {status.decisionNote}
        </p>
      ) : null}

      {!inReview && step ? (
        <StepForm step={step} busy={busy} onSubmit={send} />
      ) : null}

      {!inReview && !step ? (
        <div className="form">
          {status.riskProfile ? (
            <p>
              {t('riskProfile')}: <strong>{status.riskProfile}</strong>
            </p>
          ) : null}
          <button className="primary" disabled={busy} onClick={() => send('/onboarding/submit')}>
            {t('submit')}
          </button>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function StepForm({
  step,
  busy,
  onSubmit,
}: {
  step: Step;
  busy: boolean;
  onSubmit: (path: string, body: unknown) => void;
}) {
  switch (step) {
    case 'IDENTITY':
      return <IdentityForm busy={busy} onSubmit={(b) => onSubmit('/onboarding/identity', b)} />;
    case 'PROFILE':
      return <ProfileForm busy={busy} onSubmit={(b) => onSubmit('/onboarding/profile', b)} />;
    case 'SUITABILITY':
      return <SuitabilityForm busy={busy} onSubmit={(b) => onSubmit('/onboarding/suitability', b)} />;
    case 'UNIFIED_CODE':
      return <UnifiedCodeForm busy={busy} onSubmit={(b) => onSubmit('/onboarding/unified-code', b)} />;
    case 'CONSENTS':
      return <ConsentsForm busy={busy} onSubmit={(b) => onSubmit('/onboarding/consents', b)} />;
  }
}

type FormProps = { busy: boolean; onSubmit: (body: unknown) => void };

function Form({ busy, onSubmit, children }: { busy: boolean; onSubmit: () => void; children: ReactNode }) {
  const { t } = useApp();
  return (
    <form
      className="form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <button className="primary" disabled={busy}>
        {t('continue')}
      </button>
    </form>
  );
}

function IdentityForm({ busy, onSubmit }: FormProps) {
  const { t } = useApp();
  const [nationalId, setNationalId] = useState('');
  const [fullNameEn, setName] = useState('');
  return (
    <Form busy={busy} onSubmit={() => onSubmit({ nationalId, fullNameEn })}>
      <p className="muted">{t('identityHelp')}</p>
      <label>
        {t('nationalId')}
        <input value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))} maxLength={14} required inputMode="numeric" dir="ltr" />
      </label>
      <label>
        {t('fullNameEn')}
        <input value={fullNameEn} onChange={(e) => setName(e.target.value)} required dir="ltr" />
      </label>
    </Form>
  );
}

function ProfileForm({ busy, onSubmit }: FormProps) {
  const { t } = useApp();
  const [f, setF] = useState({
    fullNameAr: '',
    address: '',
    occupation: '',
    employer: '',
    incomeBand: 'UNDER_250K',
    sourceOfFunds: 'SALARY',
    isPep: false,
    taxResidency: 'EG',
  });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Form busy={busy} onSubmit={() => onSubmit({ ...f, employer: f.employer || undefined })}>
      <label>
        {t('fullNameAr')}
        <input value={f.fullNameAr} onChange={set('fullNameAr')} required dir="rtl" />
      </label>
      <label>
        {t('address')}
        <input value={f.address} onChange={set('address')} required />
      </label>
      <label>
        {t('occupation')}
        <input value={f.occupation} onChange={set('occupation')} required />
      </label>
      <label>
        {t('employer')}
        <input value={f.employer} onChange={set('employer')} />
      </label>
      <label>
        {t('incomeBand')}
        <select value={f.incomeBand} onChange={set('incomeBand')}>
          {['UNDER_250K', '250K_1M', '1M_5M', 'OVER_5M'].map((v) => (
            <option key={v} value={v}>
              {t(`income_${v}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('sourceOfFunds')}
        <select value={f.sourceOfFunds} onChange={set('sourceOfFunds')}>
          {['SALARY', 'BUSINESS', 'SAVINGS', 'INHERITANCE', 'OTHER'].map((v) => (
            <option key={v} value={v}>
              {t(`sof_${v}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={f.isPep} onChange={(e) => setF({ ...f, isPep: e.target.checked })} />
        {t('isPep')}
      </label>
    </Form>
  );
}

function Choice({ name, label, value, onChange, options }: { name: string; label: string; value: number; onChange: (v: number) => void; options: string[] }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      {options.map((o, i) => (
        <label key={o} className="check">
          <input type="radio" name={name} checked={value === i + 1} onChange={() => onChange(i + 1)} />
          {o}
        </label>
      ))}
    </fieldset>
  );
}

function SuitabilityForm({ busy, onSubmit }: FormProps) {
  const { t } = useApp();
  const [a, setA] = useState({ horizon: 2, lossTolerance: 1, experience: 1 });
  return (
    <Form busy={busy} onSubmit={() => onSubmit(a)}>
      <Choice name="horizon" label={t('horizon')} value={a.horizon} onChange={(v) => setA({ ...a, horizon: v })} options={[t('horizon_1'), t('horizon_2'), t('horizon_3')]} />
      <Choice name="loss" label={t('lossTolerance')} value={a.lossTolerance} onChange={(v) => setA({ ...a, lossTolerance: v })} options={[t('loss_1'), t('loss_2'), t('loss_3')]} />
      <Choice name="exp" label={t('experience')} value={a.experience} onChange={(v) => setA({ ...a, experience: v })} options={[t('exp_1'), t('exp_2'), t('exp_3')]} />
    </Form>
  );
}

function UnifiedCodeForm({ busy, onSubmit }: FormProps) {
  const { t } = useApp();
  const [has, setHas] = useState(false);
  const [code, setCode] = useState('');
  return (
    <Form busy={busy} onSubmit={() => onSubmit(has ? { hasExistingCode: true, code } : { hasExistingCode: false })}>
      <label className="check">
        <input type="radio" name="code" checked={!has} onChange={() => setHas(false)} />
        {t('needCode')}
      </label>
      <label className="check">
        <input type="radio" name="code" checked={has} onChange={() => setHas(true)} />
        {t('hasCode')}
      </label>
      {has ? (
        <label>
          {t('unifiedCode')}
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required inputMode="numeric" dir="ltr" />
        </label>
      ) : null}
    </Form>
  );
}

const CONSENTS = ['TERMS', 'RISK_DISCLOSURE', 'PRIVACY_PDPL', 'ESIGN'];

function ConsentsForm({ busy, onSubmit }: FormProps) {
  const { t, tenant } = useApp();
  const [accepted, setAccepted] = useState<string[]>([]);
  const docs = tenant.branding.legalDocuments;
  const links: Record<string, string> = { TERMS: docs.termsUrl, RISK_DISCLOSURE: docs.riskDisclosureUrl, PRIVACY_PDPL: docs.privacyUrl };
  return (
    <Form busy={busy || accepted.length < CONSENTS.length} onSubmit={() => onSubmit({ accepted })}>
      {CONSENTS.map((c) => (
        <label key={c} className="check">
          <input
            type="checkbox"
            checked={accepted.includes(c)}
            onChange={(e) => setAccepted(e.target.checked ? [...accepted, c] : accepted.filter((x) => x !== c))}
          />
          {links[c] ? <a href={links[c]} target="_blank" rel="noreferrer">{t(`consent_${c}`)}</a> : t(`consent_${c}`)}
        </label>
      ))}
    </Form>
  );
}

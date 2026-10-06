import { useEffect, useMemo, useState } from 'react';
import { GOVERNORATE_LABEL, LANDING, type LandingLocale } from './content';
import './landing.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TENORS = [91, 182, 273, 364] as const;
const AMOUNT_BANDS = ['UNDER_10K', 'FROM_10K_TO_50K', 'FROM_50K_TO_250K', 'FROM_250K_TO_1M', 'OVER_1M'];
const SAVES_IN = ['DEPOSIT', 'CERTIFICATE', 'GOLD', 'NONE', 'OTHER'];

interface CalcResult {
  totalCost: string;
  totalReceivedNet: string;
  netProfit: string;
  netAnnualReturn: string;
  paper: { termDays: number };
  returnBreakdown: { netYield?: string; depositRate?: string; vsDeposit?: string; belowDeposit?: boolean };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? 'Something went wrong');
  return json as T;
}

/** UTM-style attribution, so we can tell which channel actually works. */
function attribution() {
  const q = new URLSearchParams(window.location.search);
  return {
    source: q.get('utm_source') ?? q.get('src') ?? undefined,
    campaign: q.get('utm_campaign') ?? undefined,
  };
}

const egp = (locale: LandingLocale, v: string) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
  }).format(Number(v));

const num = (locale: LandingLocale, v: number) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG').format(v);

const pct = (locale: LandingLocale, v?: string) =>
  v == null ? '—' : new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'percent', maximumFractionDigits: 2,
  }).format(Number(v));

/**
 * The campaign landing page: educate, let people see the number for themselves,
 * and capture intent. Deliberately asks for no identity — see landing/content.ts
 * for the copy guardrails and the reasons behind them.
 */
export function PublicLanding() {
  const [locale, setLocale] = useState<LandingLocale>('ar');
  const t = LANDING[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = t.dir;
    document.title = locale === 'ar' ? 'أجيال · استثمر في أذون الخزانة' : 'Agyal · Invest in treasury bills';
  }, [locale, t.dir]);

  // --- calculator -----------------------------------------------------------
  const [amount, setAmount] = useState('50000');
  const [tenor, setTenor] = useState<number>(91);
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcErr, setCalcErr] = useState<string | null>(null);

  async function runCalc(e: React.FormEvent) {
    e.preventDefault();
    setCalcBusy(true);
    setCalcErr(null);
    try {
      setCalc(await post<CalcResult>('public/campaign/calculate', {
        amount: Number(amount), tenorDays: tenor, locale,
      }));
    } catch (err) {
      setCalc(null);
      setCalcErr(err instanceof Error ? err.message : 'Error');
    } finally {
      setCalcBusy(false);
    }
  }

  // --- waitlist -------------------------------------------------------------
  const [form, setForm] = useState({
    name: '', email: '', mobile: '', governorate: '', amountBand: '', savesIn: '', consent: false, website: '',
  });
  const [joinState, setJoinState] = useState<'idle' | 'sending' | 'done' | 'again'>('idle');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoinErr(null);
    if (!form.consent) return setJoinErr(t.fErrorConsent);
    if (!form.email && !form.mobile) return setJoinErr(t.fErrorContact);
    setJoinState('sending');
    try {
      const r = await post<{ alreadyOn: boolean }>('public/campaign/waitlist', {
        name: form.name,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        governorate: form.governorate || undefined,
        amountBand: form.amountBand || undefined,
        savesIn: form.savesIn || undefined,
        locale,
        consent: true,
        website: form.website || undefined,
        ...attribution(),
      });
      setJoinState(r.alreadyOn ? 'again' : 'done');
    } catch (err) {
      setJoinState('idle');
      setJoinErr(err instanceof Error ? err.message : 'Error');
    }
  }

  const govs = useMemo(() => Object.keys(GOVERNORATE_LABEL), []);

  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="lp-bar-in">
          <span className="lp-brand">{t.brand}</span>
          <nav>
            <a href="#calc">{t.navCalc}</a>
            <a href="#how">{t.navHow}</a>
            {/* Existing clients and the demo reach the product from here. */}
            <a href="/app" className="lp-nav-signin">{t.navSignIn}</a>
            <a href="#join" className="lp-nav-cta">{t.navJoin}</a>
            <button type="button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{t.switch}</button>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-in">
          <p className="lp-eyebrow">{t.heroEyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lp-lead">{t.heroLead}</p>
          <p className="lp-note">{t.heroNote}</p>
          <a className="lp-cta" href="#join">{t.navJoin}</a>
        </div>
      </section>

      <section className="lp-sec" id="calc">
        <div className="lp-in">
          <h2>{t.calcTitle}</h2>
          <p className="lp-lead">{t.calcLead}</p>
          <form className="lp-calc" onSubmit={runCalc}>
            <label>
              <span>{t.calcAmount}</span>
              <input
                type="number" min={1000} step={1000} inputMode="numeric" required
                value={amount} onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              <span>{t.calcTenor}</span>
              <select value={tenor} onChange={(e) => setTenor(Number(e.target.value))}>
                {TENORS.map((d) => {
                  const m = Math.round(d / 30.4);
                  return <option key={d} value={d}>{t.months(m, num(locale, m))}</option>;
                })}
              </select>
            </label>
            <button type="submit" disabled={calcBusy}>{calcBusy ? t.calcWorking : t.calcGo}</button>
          </form>

          {calcErr ? <p className="lp-err">{calcErr}</p> : null}

          {calc ? (
            <div className="lp-res">
              <div className="lp-res-grid">
                <div><small>{t.resInvested}</small><strong>{egp(locale, calc.totalCost)}</strong></div>
                <div><small>{t.resReceive}</small><strong>{egp(locale, calc.totalReceivedNet)}</strong></div>
                <div className="lp-res-hi"><small>{t.resProfit}</small><strong>{egp(locale, calc.netProfit)}</strong></div>
                <div><small>{t.resNetYield}</small><strong>{pct(locale, calc.netAnnualReturn)}</strong></div>
              </div>
              <p className="lp-res-vs">
                {t.resVsDeposit}: <strong>{pct(locale, calc.returnBreakdown.depositRate)}</strong>
                {calc.returnBreakdown.vsDeposit != null ? (
                  <span className={calc.returnBreakdown.belowDeposit ? 'lp-worse' : 'lp-better'}>
                    {' · '}
                    {calc.returnBreakdown.belowDeposit
                      ? t.resWorse(pct(locale, calc.returnBreakdown.vsDeposit))
                      : t.resBetter(pct(locale, calc.returnBreakdown.vsDeposit))}
                  </span>
                ) : null}
              </p>
              <p className="lp-fine">{t.resAfterTax} · {t.calcDisclaimer}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="lp-sec lp-alt" id="how">
        <div className="lp-in">
          <h2>{t.howTitle}</h2>
          <div className="lp-how">
            {t.how.map((c) => (
              <article key={c.h}><h3>{c.h}</h3><p>{c.p}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec" id="demo">
        <div className="lp-in">
          <div className="lp-demo">
            <div>
              <h2>{t.demoTitle}</h2>
              <p className="lp-lead">{t.demoLead}</p>
              {/* Same link the broker showcase uses, so the demo tenant resolves. */}
              <a className="lp-cta" href="/app?broker=demo-broker&login=1">{t.demoCta}</a>
            </div>
            <p className="lp-demo-warn">{t.demoWarning}</p>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="join">
        <div className="lp-in lp-narrow">
          <h2>{t.joinTitle}</h2>
          <p className="lp-lead">{t.joinLead}</p>

          {joinState === 'done' || joinState === 'again' ? (
            <p className="lp-ok">{joinState === 'done' ? t.fDone : t.fDoneAgain}</p>
          ) : (
            <form className="lp-form" onSubmit={join}>
              <label><span>{t.fName}</span>
                <input required minLength={2} value={form.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <div className="lp-two">
                <label><span>{t.fEmail}</span>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                </label>
                <label><span>{t.fMobile}</span>
                  <input type="tel" inputMode="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
                </label>
              </div>
              <p className="lp-fine">{t.fOneOf}</p>
              <div className="lp-two">
                <label><span>{t.fGovernorate}</span>
                  <select value={form.governorate} onChange={(e) => set('governorate', e.target.value)}>
                    <option value="">{t.fChoose}</option>
                    {govs.map((g) => <option key={g} value={g}>{GOVERNORATE_LABEL[g][locale]}</option>)}
                  </select>
                </label>
                <label><span>{t.fAmount}</span>
                  <select value={form.amountBand} onChange={(e) => set('amountBand', e.target.value)}>
                    <option value="">{t.fChoose}</option>
                    {AMOUNT_BANDS.map((b) => <option key={b} value={b}>{t.amountBands[b]}</option>)}
                  </select>
                </label>
              </div>
              <label><span>{t.fSaves}</span>
                <select value={form.savesIn} onChange={(e) => set('savesIn', e.target.value)}>
                  <option value="">{t.fChoose}</option>
                  {SAVES_IN.map((s) => <option key={s} value={s}>{t.savesIn[s]}</option>)}
                </select>
              </label>

              {/* Honeypot: hidden from people, filled by bots */}
              <input
                className="lp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={form.website} onChange={(e) => set('website', e.target.value)}
              />

              <label className="lp-check">
                <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} />
                <span>{t.fConsent}</span>
              </label>

              {joinErr ? <p className="lp-err">{joinErr}</p> : null}
              <button type="submit" disabled={joinState === 'sending'}>
                {joinState === 'sending' ? t.fSending : t.fSubmit}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-in">
          <p>{t.footerLegal}</p>
          <p className="lp-fine">{t.footerPrivacy}</p>
          <p className="lp-fine">© {new Date().getFullYear()} {t.brand}</p>
        </div>
      </footer>
    </div>
  );
}

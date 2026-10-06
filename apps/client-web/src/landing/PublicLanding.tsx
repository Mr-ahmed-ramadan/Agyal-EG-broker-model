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

/** The tenant demo accounts belong to; must match PUBLIC_DEMO_SLUG on the API. */
const DEMO_TENANT = 'agyal-demo';

async function post<T>(path: string, body: unknown, tenant?: string): Promise<T> {
  const res = await fetch(`${API_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tenant ? { 'X-Tenant': tenant } : {}) },
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

  // --- demo account ---------------------------------------------------------
  // Two steps: open the account (name + email), then the emailed code. On
  // success the session token is stored under the key the app reads, and we
  // hand over to /app already signed in.
  const [demo, setDemo] = useState({ name: '', email: '', phone: '', website: '' });
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [sentTo, setSentTo] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoErr, setDemoErr] = useState<string | null>(null);
  const [signinMode, setSigninMode] = useState(false);

  async function openDemo(e: React.FormEvent) {
    e.preventDefault();
    setDemoErr(null);
    setDemoBusy(true);
    try {
      const path = signinMode ? 'public/campaign/demo-signin' : 'public/campaign/demo-signup';
      const body = signinMode
        ? { email: demo.email }
        : { name: demo.name, email: demo.email, phone: demo.phone || undefined, locale, website: demo.website || undefined, ...attribution() };
      const r = await post<{ challengeId?: string; sentTo?: string }>(path, body);
      if (!r.challengeId) {
        // Unknown address on sign-in, or a bot: say nothing more.
        setDemoErr(t.fErrorContact);
        return;
      }
      setChallengeId(r.challengeId);
      setSentTo(r.sentTo ?? demo.email);
      setStep('code');
    } catch (err) {
      setDemoErr(err instanceof Error ? err.message : 'Error');
    } finally {
      setDemoBusy(false);
    }
  }

  async function enterCode(e: React.FormEvent) {
    e.preventDefault();
    setDemoErr(null);
    setDemoBusy(true);
    try {
      const r = await post<{ accessToken: string }>('auth/verify-otp', { challengeId, code }, DEMO_TENANT);
      // Hand over to the app already signed in. These keys are written out
      // literally rather than imported from lib/api, because that module fixes
      // its broker at load time from the URL — on this page that would resolve
      // to VITE_TENANT and write the token under the wrong broker's key.
      // Storage can throw (private windows); the app survives without it by
      // asking for a sign-in, so a failure here is not worth blocking on.
      try {
        sessionStorage.setItem('agyal.broker', DEMO_TENANT);
        localStorage.setItem(`agyal.client.token.${DEMO_TENANT}`, r.accessToken);
      } catch { /* fall through: the app will ask them to sign in */ }
      window.location.href = `/app?broker=${DEMO_TENANT}`;
    } catch (err) {
      setDemoErr(err instanceof Error ? err.message : 'Error');
      setDemoBusy(false);
    }
  }

  // --- feedback on the beta --------------------------------------------------
  const [fb, setFb] = useState({ message: '', email: '', website: '' });
  const [fbState, setFbState] = useState<'idle' | 'sending' | 'done'>('idle');

  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault();
    setFbState('sending');
    try {
      await post('public/campaign/feedback', {
        message: fb.message,
        email: fb.email || undefined,
        locale,
        website: fb.website || undefined,
        ...attribution(),
      });
      setFbState('done');
    } catch {
      // Feedback is not worth an error message in the reader's face; it is
      // already a favour. Treat it as sent and move on.
      setFbState('done');
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
            <span className="lp-beta">{t.beta}</span>
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
          <a className="lp-cta" href="#join">{t.signupCta}</a>
        </div>
      </section>

      {/* The point of the page: a deposit and a treasury bill both hold cash for
          a term, and this is how they differ. Tax is included rather than
          glossed, since deposit interest is exempt for individuals and treasury
          interest is not, which the gross rates alone would hide. */}
      <section className="lp-sec lp-alt" id="how-diff">
        <div className="lp-in">
          <h2>{t.diffTitle}</h2>
          <p className="lp-lead">{t.diffLead}</p>
          <table className="lp-diff">
            <thead>
              <tr><th /><th>{t.diffColDeposit}</th><th>{t.diffColBill}</th></tr>
            </thead>
            <tbody>
              {t.diff.map((r) => (
                <tr key={r.k}>
                  <th scope="row">{r.k}</th>
                  <td>{r.deposit}</td>
                  <td className="lp-diff-ours">{r.bill}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lp-fine">{t.diffNote}</p>
        </div>
      </section>

      <section className="lp-sec" id="why">
        <div className="lp-in">
          <h2>{t.whyTitle}</h2>
          <p className="lp-lead">{t.whyLead}</p>
          <div className="lp-how">
            {t.why.map((c) => (
              <article key={c.h}><h3>{c.h}</h3><p>{c.p}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec lp-alt" id="assets">
        <div className="lp-in">
          <h2>{t.assetsTitle}</h2>
          <p className="lp-lead">{t.assetsLead}</p>
          <div className="lp-assets">
            {t.assets.map((a) => (
              <article key={a.h}><h3>{a.h}</h3><p>{a.p}</p></article>
            ))}
          </div>
          {/* Government and company paper are not the same risk; say so rather
              than let the broader range imply they are. */}
          <p className="lp-fine">{t.assetsRisk}</p>
          <p className="lp-soon">{t.assetsFx}</p>
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


      <section className="lp-sec lp-alt" id="join">
        <div className="lp-in lp-narrow">
          <h2>{t.signupTitle}</h2>
          <p className="lp-lead">{t.signupLead}</p>

          {step === 'form' ? (
            <form className="lp-form" onSubmit={openDemo}>
              {!signinMode ? (
                <label><span>{t.fName}</span>
                  <input required minLength={2} value={demo.name}
                    onChange={(e) => setDemo((d) => ({ ...d, name: e.target.value }))} />
                </label>
              ) : null}
              <label><span>{t.fEmail}</span>
                <input type="email" required value={demo.email}
                  onChange={(e) => setDemo((d) => ({ ...d, email: e.target.value }))} />
              </label>
              {!signinMode ? (
                <label><span>{t.fPhone}</span>
                  <input type="tel" inputMode="tel" placeholder="01012345678" value={demo.phone}
                    onChange={(e) => setDemo((d) => ({ ...d, phone: e.target.value }))} />
                  <small className="lp-fine">{t.fPhoneHint}</small>
                </label>
              ) : null}
              <input className="lp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={demo.website} onChange={(e) => setDemo((d) => ({ ...d, website: e.target.value }))} />
              <p className="lp-demo-warn">{t.signupWarning}</p>
              {demoErr ? <p className="lp-err">{demoErr}</p> : null}
              <button type="submit" disabled={demoBusy}>
                {demoBusy ? t.signupSending : signinMode ? t.signinHere : t.signupSubmit}
              </button>
              <p className="lp-fine">
                {signinMode ? '' : t.haveAccount}{' '}
                <button type="button" className="lp-link" onClick={() => { setSigninMode(!signinMode); setDemoErr(null); }}>
                  {signinMode ? t.signupCta : t.signinHere}
                </button>
              </p>
            </form>
          ) : (
            <form className="lp-form" onSubmit={enterCode}>
              <h3>{t.codeTitle}</h3>
              <p className="lp-fine">{t.codeLead(sentTo)}</p>
              <label><span>{t.codeField}</span>
                <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
              {demoErr ? <p className="lp-err">{demoErr}</p> : null}
              <button type="submit" disabled={demoBusy}>{demoBusy ? t.codeSending : t.codeCta}</button>
            </form>
          )}
        </div>
      </section>

      <section className="lp-sec" id="waitlist">
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

      <section className="lp-sec lp-alt" id="feedback">
        <div className="lp-in lp-narrow">
          <h2>{t.fbTitle}</h2>
          <p className="lp-lead">{t.fbLead}</p>
          {fbState === 'done' ? (
            <p className="lp-ok">{t.fbDone}</p>
          ) : (
            <form className="lp-form" onSubmit={sendFeedback}>
              <label><span>{t.fbMessage}</span>
                <textarea required minLength={3} maxLength={2000} rows={4} value={fb.message}
                  onChange={(e) => setFb((f) => ({ ...f, message: e.target.value }))} />
              </label>
              <label><span>{t.fbEmail}</span>
                <input type="email" value={fb.email}
                  onChange={(e) => setFb((f) => ({ ...f, email: e.target.value }))} />
              </label>
              <input className="lp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={fb.website} onChange={(e) => setFb((f) => ({ ...f, website: e.target.value }))} />
              <button type="submit" disabled={fbState === 'sending'}>
                {fbState === 'sending' ? t.fbSending : t.fbSubmit}
              </button>
              <p className="lp-fine">{t.fbOrEmail} <a href="mailto:hello@agyal.net">hello@agyal.net</a></p>
            </form>
          )}
        </div>
      </section>

      {/* Brokers and banks are a different audience with a different page.
          Kept quiet and near the end so it does not compete with the retail call. */}
      <section className="lp-pro">
        <div className="lp-in">
          <div>
            <h3>{t.proTitle}</h3>
            <p>{t.proLead}</p>
          </div>
          <a href="https://egypt.agyal.net" target="_blank" rel="noopener noreferrer">{t.proCta}</a>
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

import { useEffect, useState } from 'react';
import { LANDING, type LandingLocale } from './content';
import './landing.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TENORS = [91, 182, 273, 364] as const;

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

/** Which field the API objected to, so the page can say so in the reader's language. */
class FieldError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, tenant?: string): Promise<T> {
  const res = await fetch(`${API_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tenant ? { 'X-Tenant': tenant } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The API names the field and the reason; showing only "Validation failed"
    // left people with no idea which box to fix.
    const { message, issues } = json as { message?: string; issues?: { path: string; message: string }[] };
    const first = issues?.[0];
    if (first) throw new FieldError(first.path, `${first.path}: ${first.message}`);
    throw new Error(message ?? 'Something went wrong');
  }
  return json as T;
}

/** UTM-style attribution, so we can tell which channel actually works. */
function attribution() {
  const q = new URLSearchParams(window.location.search);
  // Ad platforms append long campaign strings. The API stores 60 characters,
  // so send 60: a tracking tag must never be the reason a signup is refused.
  const tag = (v: string | null) => (v ? v.slice(0, 60) : undefined);
  return {
    source: tag(q.get('utm_source') ?? q.get('src')),
    campaign: tag(q.get('utm_campaign')),
  };
}

/**
 * The API answers in English and names the field. The page is read in Arabic by
 * default, so turn the field into a sentence the reader can act on, and keep
 * the API's own words only when it is something we have no phrase for.
 */
function explain(err: unknown, t: (typeof LANDING)[LandingLocale]): string {
  if (err instanceof FieldError) {
    const byField: Record<string, string | undefined> = {
      name: t.errName,
      email: t.errEmail,
      phone: t.errPhone,
    };
    return byField[err.field] ?? err.message;
  }
  return err instanceof Error ? err.message : t.errGeneric;
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
 * The campaign landing page. It reads in one order and nothing is allowed
 * between the steps: what this is, how the instruments differ from the deposit
 * or certificate the reader already holds, the calculator on their own number,
 * then the demo account. Everything else sits below that call to action.
 *
 * The only account offered is a demo one, and the page says so. See
 * landing/content.ts for the copy guardrails and the reasons behind them.
 */
export function PublicLanding() {
  const [locale, setLocale] = useState<LandingLocale>('ar');
  const t = LANDING[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = t.dir;
    document.title = locale === 'ar' ? 'أجيال · الدخل الثابت في مصر' : 'Agyal · Fixed income in Egypt';
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
      setDemoErr(explain(err, t));
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
      setDemoErr(explain(err, t));
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

  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="lp-bar-in">
          <span className="lp-brand">{t.brand}</span>
          <span className="lp-beta">{t.beta}</span>
          <nav>
            <a href="#compare">{t.navDiff}</a>
            <a href="#calc">{t.navCalc}</a>
            {/* Existing clients and the demo reach the product from here. */}
            <a href="/app" className="lp-nav-signin">{t.navSignIn}</a>
            <a href="#join" className="lp-nav-cta">{t.navJoin}</a>
            <button type="button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{t.switch}</button>
          </nav>
        </div>
      </header>

      {/* 1. What is this? */}
      <section className="lp-hero">
        <div className="lp-in">
          <p className="lp-eyebrow">{t.heroEyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lp-lead">{t.heroLead}</p>
          <a className="lp-cta" href="#join">{t.signupCta}</a>
        </div>
      </section>

      {/* 2. The four instruments side by side, each answering the same three
          questions, so a reader holding a deposit or a certificate can place
          the rest against what they already have. Tax is one of the three
          because deposit interest is exempt for individuals and treasury
          interest is not, which the headline rates alone would hide. */}
      <section className="lp-sec lp-alt" id="compare">
        <div className="lp-in">
          <h2>{t.cmpTitle}</h2>
          <p className="lp-lead">{t.cmpLead}</p>
          <h3 className="lp-cmp-head">{t.cmpChars}</h3>
          <div className="lp-cmp">
            {t.cmp.map((c, i) => (
              <article key={c.h} className={i === 0 ? 'lp-cmp-base' : undefined}>
                <h3>{c.h}</h3>
                <dl>
                  <dt>{t.cmpWho}</dt><dd>{c.who}</dd>
                  <dt>{t.cmpTerm}</dt><dd>{c.term}</dd>
                  <dt>{t.cmpYield}</dt><dd>{c.yield}</dd>
                </dl>
              </article>
            ))}
          </div>
          {/* A company can fail to pay in a way the government is far less
              likely to, and that is why its paper offers more. Said in those
              terms rather than as a bare word, and never left out: the broader
              instrument range must not inherit the safety of government paper. */}
          <p className="lp-fine">{t.cmpNote}</p>
          <p className="lp-soon">{t.cmpFx}</p>
          <p className="lp-fine">{t.cmpToCalc}</p>
        </div>
      </section>

      {/* 3. Their own number. */}
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

      {/* 4. The only account on offer: a demo one, while the platform is
          being finished. The one call to action on the page. */}
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
              {/* Honeypot: hidden from people, filled by bots */}
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

      {/* Below the call to action: for the reader who is still deciding. */}
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

      <section className="lp-sec" id="feedback">
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

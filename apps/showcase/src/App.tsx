import { useEffect, useState, type FormEvent } from 'react';
import { content, type Locale } from './content';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Network failure (API down, wrong VITE_API_URL, CORS): say where we tried, not just "Failed to fetch". */
function unreachable(): never {
  throw new Error(`Can't reach the server at ${API_URL}. Please try again shortly.`);
}

function initialLocale(): Locale {
  const fromLink = new URLSearchParams(window.location.search).get('lang');
  if (fromLink === 'ar' || fromLink === 'en') return fromLink;
  return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = content[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  return (
    <>
      <header className="nav">
        <a className="logo" href="#top" aria-label="Agyal Egypt">
          <span className="mark">A</span>
          <span>Agyal <em>Egypt</em></span>
        </a>
        <nav>
          <a href="#how">{t.nav.how}</a>
          <a href="#features">{t.nav.features}</a>
          <a href="#pricing">{t.nav.pricing}</a>
          <a href="#faq">{t.nav.faq}</a>
        </nav>
        <div className="nav-actions">
          <button className="lang" onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>{t.nav.lang}</button>
          <a className="btn small" href="#contact">{t.nav.cta}</a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">{t.hero.eyebrow}</p>
            <h1>{t.hero.title}</h1>
            <p className="lead">{t.hero.lead}</p>
            <div className="ctas">
              <a className="btn" href="#contact">{t.hero.primary}</a>
              <a className="btn ghost" href="#how">{t.hero.secondary}</a>
            </div>
            <p className="note">{t.hero.note}</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <Phone src="/screens/client-quote.png" alt={t.screens.captions.quote} />
          </div>
        </section>

        <section className="band">
          <h2>{t.why.title}</h2>
          <div className="cards three">
            {t.why.items.map((i) => (
              <article key={i.title} className="card">
                <h3>{i.title}</h3>
                <p>{i.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how">
          <h2>{t.how.title}</h2>
          <ol className="steps">
            {t.how.steps.map((s, n) => (
              <li key={s.title}>
                <span className="num">{n + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="band">
          <h2>{t.features.title}</h2>
          <div className="cards four">
            {t.features.items.map((f) => (
              <article key={f.title} className="card feature">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>{t.screens.title}</h2>
          <h3 className="sub">{t.screens.client}</h3>
          <div className="gallery phones">
            <Phone src="/screens/client-quote.png" alt={t.screens.captions.quote} caption={t.screens.captions.quote} />
            <Phone src="/screens/client-sell.png" alt={t.screens.captions.sell} caption={t.screens.captions.sell} />
            <Phone src="/screens/client-arabic.png" alt={t.screens.captions.arabic} caption={t.screens.captions.arabic} />
          </div>
          <h3 className="sub">{t.screens.broker}</h3>
          <div className="gallery desktops">
            <Shot src="/screens/broker-orders.png" caption={t.screens.captions.orders} />
            <Shot src="/screens/broker-settlements.png" caption={t.screens.captions.settlements} />
            <Shot src="/screens/broker-income.png" caption={t.screens.captions.income} />
          </div>
        </section>

        <section id="pricing" className="band">
          <h2>{t.pricing.title}</h2>
          <p className="lead center">{t.pricing.lead}</p>
          <div className="cards two">
            {t.pricing.items.map((p) => (
              <article key={p.title} className="card">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
          <p className="note center">{t.pricing.note}</p>
        </section>

        <section>
          <h2>{t.trust.title}</h2>
          <ul className="checks">
            {t.trust.items.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </section>

        <section id="faq" className="band">
          <h2>{t.faq.title}</h2>
          <div className="faq">
            {t.faq.items.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contact">
          <h2>{t.contact.title}</h2>
          <p className="lead center">{t.contact.lead}</p>
          <ContactForm locale={locale} />
        </section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} {t.footer}</span>
        <span dir="ltr">egypt.agyal.net</span>
      </footer>
    </>
  );
}

function Phone({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="phone">
      <div className="frame">
        <img src={src} alt={alt} loading="lazy" />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function Shot({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="shot">
      <div className="browser">
        <span /><span /><span />
      </div>
      <img src={src} alt={caption} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function ContactForm({ locale }: { locale: Locale }) {
  const t = content[locale].contact;
  const [f, setF] = useState({ name: '', firm: '', role: '', email: '', mobile: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const res = await fetch(`${API_URL}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, role: f.role || undefined, message: f.message || undefined }),
      }).catch(unreachable);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.issues?.map((i: { message: string }) => i.message).join('; ') || body?.message || t.error);
      }
      setState('done');
    } catch (err) {
      setState('error');
      setError((err as Error).message);
    }
  }

  if (state === 'done') return <p className="thanks">{t.thanks}</p>;

  return (
    <form className="contact" onSubmit={submit}>
      <label>{t.name}<input value={f.name} onChange={set('name')} required minLength={2} autoComplete="name" /></label>
      <label>{t.firm}<input value={f.firm} onChange={set('firm')} required minLength={2} autoComplete="organization" /></label>
      <label>{t.role}<input value={f.role} onChange={set('role')} autoComplete="organization-title" /></label>
      <label>{t.email}<input type="email" value={f.email} onChange={set('email')} required autoComplete="email" dir="ltr" /></label>
      <label>{t.mobile}<input type="tel" value={f.mobile} onChange={set('mobile')} autoComplete="tel" dir="ltr" placeholder="+20 10 0000 0000" /></label>
      <label className="wide">{t.message}<textarea value={f.message} onChange={set('message')} rows={4} maxLength={2000} /></label>
      {/* Honeypot: hidden from people, filled by bots */}
      <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label>
      {error ? <p className="error wide">{error}</p> : null}
      <button className="btn wide" disabled={state === 'sending'}>{state === 'sending' ? t.sending : t.submit}</button>
    </form>
  );
}

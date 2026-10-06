import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PublicLanding } from './landing/PublicLanding';
import './theme.css';

/**
 * One host serves two things: the public campaign page and the product.
 *
 * The product wins on `/app`, and on any link carrying `?broker=` or `?login=`
 * — that is how the showcase links to the demo, and those links must keep
 * working. Everything else at the root is campaign traffic and gets the landing
 * page, which must not resolve a tenant or take on a broker's branding.
 *
 * Note the broker is also remembered in localStorage, so "no ?broker= param" is
 * not on its own a safe signal: route on the path, decided here before <App />
 * mounts and fetches /tenant.
 */
function isProduct(): boolean {
  const { pathname, search } = window.location;
  if (pathname === '/app' || pathname.startsWith('/app/')) return true;
  const q = new URLSearchParams(search);
  return q.has('broker') || q.has('login');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isProduct() ? <App /> : <PublicLanding />}</StrictMode>,
);

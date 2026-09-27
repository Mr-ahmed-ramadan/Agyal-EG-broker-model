import type { Locale } from '../i18n/messages';

const tag = (l: Locale) => (l === 'ar' ? 'ar-EG' : 'en-EG');

export function money(value: string | number, locale: Locale) {
  return new Intl.NumberFormat(tag(locale), {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function nominal(value: string | number, locale: Locale) {
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 2 }).format(Number(value));
}

export function percent(fraction: string | number, locale: Locale) {
  return new Intl.NumberFormat(tag(locale), {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(Number(fraction));
}

export function price(value: string | number, locale: Locale) {
  return new Intl.NumberFormat(tag(locale), { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(
    Number(value),
  );
}

export function date(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(
    new Date(value),
  );
}

/** Fills {placeholders} in a translated message. */
export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** "91 days" or "36 months" for a term. */
export function termLabel(days: number, t: (k: string) => string, locale: Locale) {
  const n = (v: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG').format(v);
  return days <= 400 ? `${n(days)} ${t('days')}` : `${n(Math.round(days / 30.44))} ${t('months')}`;
}

export function daysUntil(value: string | Date) {
  return Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 86_400_000));
}

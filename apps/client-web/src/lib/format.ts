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

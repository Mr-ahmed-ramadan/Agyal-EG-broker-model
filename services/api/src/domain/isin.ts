/** ISIN (ISO 6166): 2-letter country, 9 alphanumerics, 1 check digit (Luhn over letters-as-numbers). */

export function isinCheckDigit(first11: string): string {
  const digits = first11
    .toUpperCase()
    .split('')
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join('');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidIsin(isin: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) && isinCheckDigit(isin.slice(0, 11)) === isin[11];
}

/** Builds a valid ISIN from its first 11 characters (demo data). */
export function withCheckDigit(first11: string): string {
  return first11 + isinCheckDigit(first11);
}

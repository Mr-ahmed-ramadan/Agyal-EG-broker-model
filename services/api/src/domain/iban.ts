/**
 * IBAN validation (ISO 13616). Egyptian IBANs are 29 characters:
 * `EG` + 2 check digits + 4-digit bank code + 4-digit branch + 17-digit account.
 */

export function normaliseIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/** Mod-97 check over the rearranged IBAN, computed in chunks to avoid big integers. */
export function ibanChecksumValid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function isValidEgyptianIban(input: string): boolean {
  const iban = normaliseIban(input);
  return /^EG\d{27}$/.test(iban) && ibanChecksumValid(iban);
}

/** Masked for display: EG38 •••• •••• 1234 */
export function maskIban(iban: string): string {
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

/** Account holder must match the client's registered name (case/spacing-insensitive). */
export function holderMatchesClient(holder: string, clientName: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(holder) === norm(clientName);
}

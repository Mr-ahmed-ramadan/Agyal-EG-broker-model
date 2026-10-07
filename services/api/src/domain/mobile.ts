/**
 * Egyptian mobile numbers, as people actually write them.
 *
 * The canonical form stored everywhere is 01XXXXXXXXX: eleven digits, the
 * operator prefix 010, 011, 012 or 015. But nobody types it that way under
 * pressure. They write +20 101 234 5678 from a contact card, or group the
 * digits, or paste a number with a dash in it. Refusing those is refusing a
 * valid number on a formatting technicality, and on a sign-up form that costs
 * the signup.
 *
 * So: accept the writing, store the canon.
 */

/** The canonical shape. What is stored, and what the gateway will be given. */
export const EGYPT_MOBILE = /^01[0125]\d{8}$/;

/**
 * The canonical number, or null when it is genuinely not an Egyptian mobile
 * (a landline, too few digits, an unknown operator prefix).
 */
export function normalizeEgyptMobile(raw: string): string | null {
  // Arabic-Indic digits paste in from phone keypads and contact apps.
  const latin = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  // Everything that is only punctuation between digits.
  const digits = latin.replace(/[\s()\-.]/g, '').replace(/^\+/, '');
  // +20 / 0020 / 20 all mean the same country; the national form keeps one 0.
  const national = digits.replace(/^(?:00)?20/, '0');
  const withZero = national.startsWith('0') ? national : `0${national}`;
  return EGYPT_MOBILE.test(withZero) ? withZero : null;
}

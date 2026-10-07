/**
 * CSV for the admin exports. Spreadsheets are where follow-up and reconciliation
 * actually happen, so the escaping has to be right: quote anything holding a
 * comma, a quote or a newline, and double the quotes inside it (RFC 4180).
 */
export const csvCell = (v: unknown) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A header row plus one line per row, in the given column order. */
export const csvTable = <T extends object>(cols: (keyof T & string)[], rows: T[]) =>
  [
    cols.join(','),
    ...rows.map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(',')),
  ].join('\n');

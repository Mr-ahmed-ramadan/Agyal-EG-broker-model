/**
 * Documents Agyal distributes as tracked links. Files live in
 * services/api/documents (never in a public folder): the only way to open one
 * is a link generated in the admin console, and every open is logged.
 */
export interface DocumentDef {
  key: string;
  title: string;
  file: string;
  blurb: string;
  /** Internal: warn before creating a link, never send to prospects */
  internal: boolean;
}

export const DOCUMENTS: DocumentDef[] = [
  {
    key: 'partnership-deck',
    title: 'Partnership deck with brokerage',
    file: 'partnership-deck.html',
    blurb:
      'The current proposal for brokerage firms: six slides — a plain-language opener, “your questions, answered”, how it works (FIX, best price across banks, you stay the licensed party), the economics waterfall, live-demo QR codes to the client app and broker console, and a 3-step pilot path. Print / Save-PDF button.',
    internal: false,
  },
  {
    key: 'speaker-notes',
    title: 'Presenter speaking notes',
    file: 'speaker-notes.html',
    blurb: 'Internal notes for presenting the partnership deck: one card per slide (what is on screen, what to say, time) plus answers to the questions brokers ask. Meant for a second screen; prints to PDF. Do not share with the broker.',
    internal: true,
  },
  {
    key: 'draft-mou',
    title: 'Draft MOU between Agyal and brokerage',
    file: 'draft-mou.html',
    blurb: 'Bilingual (English / Arabic) draft memorandum of understanding: scope (Agyal as technology provider, broker as licensed party), services and service levels, economics, data protection (Law 151/2020), confidentiality, IP and white-label rights, pilot, term and exit. Draft for legal review.',
    internal: false,
  },
  {
    key: 'technical-annex',
    title: 'Technical annex',
    file: 'technical-annex.html',
    blurb: 'Integration and security annex for the broker’s IT and compliance teams: architecture, FIX 4.4 flow with partner banks, onboarding (eKYC, AML, MCDR unified code), ledger and client money, security controls and audit, hosting, and what the broker provides. Shareable (no credentials).',
    internal: false,
  },
  {
    key: 'investor-pack',
    title: 'Investor pack',
    file: 'investor-pack.html',
    blurb: 'The investor brief: problem, product, business model and illustrative unit economics, go-to-market through brokerage firms, what is built today, roadmap and the ask. Figures are illustrative.',
    internal: false,
  },
  {
    key: 'operations-sop',
    title: 'Operations SOP (internal)',
    file: 'operations-sop.html',
    blurb: 'Internal end-to-end client lifecycle and daily operations: onboarding and compliance, unified codes and custody, deposits, trading, settlement, coupons and maturities, withdrawals, payouts and monitoring — who does what, checks and controls. Do not share externally.',
    internal: true,
  },
  {
    key: 'capability-audit',
    title: 'Capability audit & phase map (internal)',
    file: 'capability-audit.html',
    blurb: 'Internal build-state audit: capabilities by surface, an honest real-vs-simulated table, hardening required before real money, and the phase map for the next releases. Do not share externally.',
    internal: true,
  },
  {
    key: 'partnership-term-sheet',
    title: 'Partnership term sheet (internal)',
    file: 'partnership-term-sheet.html',
    blurb: 'Internal negotiation term sheet: the two-layer partnership structure — a Layer 1 revenue-share services agreement, and a Layer 2 milestone-vesting equity option in the broker’s existing firm plus an operating mandate — with cost allocation, exclusivity, change-of-control, sequencing and a legal caveat. Do not share externally.',
    internal: true,
  },
];

export function documentByKey(key: string): DocumentDef | undefined {
  return DOCUMENTS.find((d) => d.key === key);
}

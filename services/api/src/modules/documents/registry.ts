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
  /**
   * Which pack this belongs to. The admin console groups the picker by this,
   * in the order the groups first appear below, so a submission reads as a set
   * rather than as loose tiles.
   */
  group: string;
  /**
   * For an internal document that nonetheless has one permitted audience
   * outside Agyal. Without it, internal means Agyal only, which is the default
   * and the safe reading.
   */
  shareWith?: string;
}

/** Group names, kept here so the registry cannot drift into near-duplicates. */
const FRA = 'FRA sandbox submission';
const PARTNERSHIP = 'Brokers and partnership';
const INVESTORS = 'Investors';
const OPERATIONS = 'Internal operations';

export const DOCUMENTS: DocumentDef[] = [
  {
    key: 'fra-sandbox-application',
    title: 'FRA sandbox — application for Regulatory Guidance',
    file: 'fra-sandbox-application.html',
    blurb:
      'Draft submission to the FRA Sandbox, structured to the Authority’s four eligibility criteria: the innovation and an honest statement of build state, benefit to customers and the market, the roadmap (launch stages, regulatory alignment, management strategy, global precedent), and six specific areas where guidance is sought — led by whether a technology provider belongs on the outsourcing register rather than holding a licence. Contains placeholders to fill before filing.',
    internal: false,
    group: FRA,
  },
  {
    key: 'fra-sandbox-form-answers',
    title: 'FRA sandbox — online form answers',
    file: 'fra-sandbox-form-answers.html',
    blurb:
      'Paste-ready answers for the FRA Regulatory Guidance online form, written to field length rather than document length: the innovation, benefit to customers and market, the roadmap (launch, regulatory alignment, management, global experience), the specific assistance areas, the sector targeted, and why the solution addresses the non-banking financial sector. Each long answer has a short version for character-limited fields, plus the supporting-document list to attach.',
    internal: false,
    group: FRA,
  },
  {
    key: 'fra-sandbox-testing-plan',
    title: 'FRA sandbox — testing plan, KPIs and exit',
    file: 'fra-sandbox-testing-plan.html',
    blurb:
      'Companion to the FRA application: test objectives, what is in and out of scope, proposed caps on cohort and exposure, four staged phases, measurable KPIs and success criteria, consumer safeguards, reporting cadence to the Authority, stop conditions, and an orderly exit and wind-down plan. Bracketed values are proposals to agree with the partner and the FRA.',
    internal: false,
    group: FRA,
  },
  {
    key: 'fra-sandbox-checklist',
    title: 'FRA sandbox — submission checklist (internal)',
    file: 'fra-sandbox-checklist.html',
    blurb:
      'Internal working checklist for the FRA submission: how the pack answers each of the four criteria, which documents already exist and which must be written, the corporate and partner items only the applicant can supply, the questions to raise with the Authority first, a suggested sequence, and two cautions on the broker-partner dependency and not overclaiming readiness. Do not share externally.',
    internal: true,
    group: FRA,
  },
  {
    key: 'capability-audit',
    title: 'Capability audit & gap to production (internal)',
    file: 'capability-audit.html',
    blurb:
      'Internal build-state audit, checked against the code: capabilities by surface, an honest real-vs-simulated table, the hardening required before real money, and the gap to a production version split three ways — what is a stand-in behind a working interface and only needs a contract, what must actually be built (KYC evidence capture first), and what is blocked on an answer from the Authority or a counterparty rather than on engineering. Includes what the tests do not cover, and one caution on how the onboarding claim is worded in the FRA pack. Goes to the Authority with the application; not to brokers, prospects or investors.',
    internal: true,
    group: FRA,
    shareWith: 'the Authority, as the supporting document the FRA application says accompanies it',
  },
  {
    key: 'partnership-deck',
    title: 'Partnership deck with brokerage',
    file: 'partnership-deck.html',
    blurb:
      'The current proposal for brokerage firms: six slides — a plain-language opener, “your questions, answered”, how it works (FIX, best price across banks, you stay the licensed party), the economics waterfall, live-demo QR codes to the client app and broker console, and a 3-step pilot path. Print / Save-PDF button.',
    internal: false,
    group: PARTNERSHIP,
  },
  {
    key: 'speaker-notes',
    title: 'Presenter speaking notes',
    file: 'speaker-notes.html',
    blurb: 'Internal notes for presenting the partnership deck: one card per slide (what is on screen, what to say, time) plus answers to the questions brokers ask. Meant for a second screen; prints to PDF. Do not share with the broker.',
    internal: true,
    group: PARTNERSHIP,
  },
  {
    key: 'draft-mou',
    title: 'Draft MOU between Agyal and brokerage',
    file: 'draft-mou.html',
    blurb: 'Bilingual (English / Arabic) draft memorandum of understanding: scope (Agyal as technology provider, broker as licensed party), services and service levels, economics, data protection (Law 151/2020), confidentiality, IP and white-label rights, pilot, term and exit. Draft for legal review.',
    internal: false,
    group: PARTNERSHIP,
  },
  {
    key: 'technical-annex',
    title: 'Technical annex',
    file: 'technical-annex.html',
    blurb: 'Integration and security annex for the broker’s IT and compliance teams: architecture, FIX 4.4 flow with partner banks, onboarding (eKYC, AML, MCDR unified code), ledger and client money, security controls and audit, hosting, and what the broker provides. Shareable (no credentials).',
    internal: false,
    group: PARTNERSHIP,
  },
  {
    key: 'partnership-term-sheet',
    title: 'Partnership term sheet (internal)',
    file: 'partnership-term-sheet.html',
    blurb: 'Internal negotiation term sheet: the two-layer partnership structure — a Layer 1 revenue-share services agreement, and a Layer 2 milestone-vesting equity option in the broker’s existing firm plus an operating mandate — with cost allocation, exclusivity, change-of-control, sequencing and a legal caveat. Do not share externally.',
    internal: true,
    group: PARTNERSHIP,
  },
  {
    key: 'agyal-universe',
    title: 'The Agyal universe (ecosystem map)',
    file: 'agyal-universe.html',
    blurb: 'A one-page ecosystem map: Agyal at the centre as the platform behind a licensed broker, connected to investors, partner banks over FIX, the G-FIT/EGX venue, CBE and MCDR custody, the segregated client-money account, the FRA and the onboarding/auth providers. Shows where money and securities sit (never with Agyal). Shareable; prints to PDF.',
    internal: false,
    group: PARTNERSHIP,
  },
  {
    key: 'investor-pack',
    title: 'Investor pack',
    file: 'investor-pack.html',
    blurb: 'The investor brief: problem, product, business model and illustrative unit economics, go-to-market through brokerage firms, what is built today, roadmap and the ask. Figures are illustrative.',
    internal: false,
    group: INVESTORS,
  },
  {
    key: 'business-plan',
    title: 'Business plan (FRA)',
    file: 'business-plan.html',
    blurb:
      'The business plan prepared for the FRA: the model and who pays, market opportunity with an honest statement of what is not known, unit economics from the platform’s own margin defaults, a full assumptions table, the bootstrapped cost base, break-even (revenue ≈ 1% of assets, so break-even assets are 100× annual cost — reachable with one modest broker), a conservative three-year projection, funding the guided phase, sensitivities, risks and governance. Contains placeholders to complete.',
    internal: false,
    group: INVESTORS,
  },
  {
    key: 'business-plan-investor',
    title: 'Business plan (investors)',
    file: 'business-plan-investor.html',
    blurb:
      'The long-form plan behind the investor pack: why the gap exists, the white-label model and what it means for an investor (no licence, no client money on the balance sheet, no retail acquisition cost), unit economics, the Pilot → Early → Scale path, why bootstrapped-to-break-even means capital buys growth rather than runway, sensitivities including margin compression, risks stated plainly, and the ask with use of funds tied to milestones.',
    internal: false,
    group: INVESTORS,
  },
  {
    key: 'operations-sop',
    title: 'Operations SOP (internal)',
    file: 'operations-sop.html',
    blurb: 'Internal end-to-end client lifecycle and daily operations: onboarding and compliance, unified codes and custody, deposits, trading, settlement, coupons and maturities, withdrawals, payouts and monitoring — who does what, checks and controls. Do not share externally.',
    internal: true,
    group: OPERATIONS,
  },
];

export function documentByKey(key: string): DocumentDef | undefined {
  return DOCUMENTS.find((d) => d.key === key);
}

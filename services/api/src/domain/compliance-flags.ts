/** Agyal's KYC/AML monitoring flags on a broker's client (ADR 0005). */

export const FLAG_REASONS = ['PEP_NOT_ESCALATED', 'SANCTIONS_HIT', 'ADVERSE_MEDIA', 'REVIEW_OVERDUE', 'DOCUMENTS', 'OTHER'] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
export type FlagStatus = 'OPEN' | 'RESOLVED';

export interface AmlSummary {
  riskRating?: string;
  isPep?: boolean;
  hits?: { list: string; name: string }[];
}

/** Risk flag for display: sanctions beat PEP beat other hits. */
export function amlFlag(aml: AmlSummary | null | undefined): 'NONE' | 'PEP' | 'SANCTIONS' | 'HIT' {
  if (!aml) return 'NONE';
  const hits = aml.hits ?? [];
  if (hits.some((h) => h.list === 'SANCTIONS')) return 'SANCTIONS';
  if (aml.isPep || hits.some((h) => h.list === 'PEP')) return 'PEP';
  return hits.length ? 'HIT' : 'NONE';
}

/** Whole days an application has waited since it was submitted (0 if not submitted or already decided). */
export function daysInQueue(submittedAt: Date | null, decidedAt: Date | null, now = new Date()): number {
  if (!submittedAt || decidedAt) return 0;
  return Math.floor((now.getTime() - submittedAt.getTime()) / 86_400_000);
}

export function isReviewOverdue(kycReviewDueAt: Date | null, now = new Date()): boolean {
  return !!kycReviewDueAt && kycReviewDueAt < now;
}

/** A broker can only respond to an open flag, and must say something. */
export function resolutionProblem(status: FlagStatus, response: string): string | null {
  if (status !== 'OPEN') return 'This flag is already resolved';
  if (response.trim().length < 5) return 'Please explain how the flag was addressed';
  return null;
}

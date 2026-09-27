/**
 * Onboarding rules (ADR 0005): national ID parsing, suitability scoring and
 * the broker's auto-approval decision.
 */

export interface NationalIdInfo {
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE';
  governorateCode: string;
}

/**
 * Parses an Egyptian 14-digit national ID:
 * C YYMMDD GG SSSS K - century digit (2 = 1900s, 3 = 2000s), birth date,
 * governorate code, sequence (odd 4th sequence digit = male), check digit.
 * Returns null if the format or date is invalid.
 */
export function parseNationalId(id: string): NationalIdInfo | null {
  if (!/^[23]\d{13}$/.test(id)) return null;
  const century = id[0] === '2' ? 1900 : 2000;
  const year = century + Number(id.slice(1, 3));
  const month = Number(id.slice(3, 5));
  const day = Number(id.slice(5, 7));
  const dob = new Date(Date.UTC(year, month - 1, day));
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== month - 1 || dob.getUTCDate() !== day) {
    return null;
  }
  if (dob > new Date()) return null;
  return {
    dateOfBirth: dob,
    gender: Number(id[12]) % 2 === 1 ? 'MALE' : 'FEMALE',
    governorateCode: id.slice(7, 9),
  };
}

export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

export type RiskProfile = 'CONSERVATIVE' | 'BALANCED' | 'GROWTH';

export interface SuitabilityAnswers {
  /** 1 = under 1 year, 2 = 1-3 years, 3 = over 3 years */
  horizon: 1 | 2 | 3;
  /** 1 = cannot accept losses, 2 = small, 3 = moderate */
  lossTolerance: 1 | 2 | 3;
  /** 1 = none, 2 = some, 3 = experienced with bonds */
  experience: 1 | 2 | 3;
}

export function scoreSuitability(a: SuitabilityAnswers): RiskProfile {
  const score = a.horizon + a.lossTolerance + a.experience;
  if (score <= 4) return 'CONSERVATIVE';
  if (score <= 7) return 'BALANCED';
  return 'GROWTH';
}

/** Instrument types allowed per risk profile (brokers can tighten this later). */
export function isInstrumentSuitable(profile: RiskProfile, type: string): boolean {
  if (type === 'TREASURY_BILL' || type === 'TREASURY_BOND') return true;
  return profile !== 'CONSERVATIVE';
}

export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AutoApprovalRule {
  enabled: boolean;
  /** Highest AML risk rating that can be auto-approved */
  maxRiskRating: RiskRating;
  version: string;
}

export interface DecisionInput {
  ekycPassed: boolean;
  riskRating: RiskRating;
  isPep: boolean;
  age: number;
}

export type Decision =
  | { outcome: 'AUTO_APPROVE'; ruleVersion: string }
  | { outcome: 'MANUAL_REVIEW'; reasons: string[] };

const RATING_ORDER: RiskRating[] = ['LOW', 'MEDIUM', 'HIGH'];

export function decide(rule: AutoApprovalRule, input: DecisionInput): Decision {
  const reasons: string[] = [];
  if (!rule.enabled) reasons.push('Auto-approval disabled by broker');
  if (!input.ekycPassed) reasons.push('eKYC not passed');
  if (input.isPep) reasons.push('Politically exposed person');
  if (input.age < 21) reasons.push('Client under 21');
  if (RATING_ORDER.indexOf(input.riskRating) > RATING_ORDER.indexOf(rule.maxRiskRating)) {
    reasons.push(`AML risk rating ${input.riskRating}`);
  }
  return reasons.length === 0
    ? { outcome: 'AUTO_APPROVE', ruleVersion: rule.version }
    : { outcome: 'MANUAL_REVIEW', reasons };
}

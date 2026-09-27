import { ageOn, parseNationalId, type RiskRating } from '../../domain/onboarding-rules';

/**
 * Vendor-agnostic eKYC and AML screening (ADR 0005). The mock implementations
 * let the whole flow run locally; a real Egyptian eKYC vendor and screening
 * list provider implement the same interfaces, per broker.
 */

export interface EkycInput {
  nationalId: string;
  fullNameEn: string;
  /** Vendor session reference from the ID-capture + liveness SDK */
  captureSessionRef?: string;
}

export interface EkycResult {
  passed: boolean;
  provider: string;
  reasons: string[];
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE';
  faceMatchScore?: number;
  livenessScore?: number;
}

export interface EkycProvider {
  verify(input: EkycInput): Promise<EkycResult>;
}

export const EKYC_PROVIDER = Symbol('EKYC_PROVIDER');

/**
 * Mock: passes any well-formed national ID of an adult. For testing failure
 * paths, an ID ending in 9999 fails the face match.
 */
export class MockEkycProvider implements EkycProvider {
  async verify(input: EkycInput): Promise<EkycResult> {
    const info = parseNationalId(input.nationalId);
    if (!info) return { passed: false, provider: 'mock', reasons: ['Invalid national ID'] };
    if (ageOn(info.dateOfBirth, new Date()) < 18) {
      return { passed: false, provider: 'mock', reasons: ['Under 18'] };
    }
    const faceMatch = input.nationalId.endsWith('9999') ? 0.42 : 0.97;
    return {
      passed: faceMatch >= 0.8,
      provider: 'mock',
      reasons: faceMatch >= 0.8 ? [] : ['Face match below threshold'],
      dateOfBirth: info.dateOfBirth.toISOString().slice(0, 10),
      gender: info.gender,
      faceMatchScore: faceMatch,
      livenessScore: 0.99,
    };
  }
}

export interface AmlInput {
  fullNameEn: string;
  dateOfBirth?: string;
  nationalId: string;
  isPepDeclared: boolean;
  sourceOfFunds: string;
  incomeBand: string;
}

export interface AmlResult {
  provider: string;
  riskRating: RiskRating;
  isPep: boolean;
  hits: { list: string; name: string; score: number }[];
  screenedAt: string;
}

export interface AmlProvider {
  screen(input: AmlInput): Promise<AmlResult>;
}

export const AML_PROVIDER = Symbol('AML_PROVIDER');

const MOCK_SANCTIONS = ['sanctioned person', 'blocked entity'];
const MOCK_PEPS = ['minister example', 'governor example'];

export class MockAmlProvider implements AmlProvider {
  async screen(input: AmlInput): Promise<AmlResult> {
    const name = input.fullNameEn.toLowerCase();
    const hits: AmlResult['hits'] = [];
    for (const s of MOCK_SANCTIONS) if (name.includes(s)) hits.push({ list: 'SANCTIONS', name: s, score: 1 });
    for (const p of MOCK_PEPS) if (name.includes(p)) hits.push({ list: 'PEP', name: p, score: 1 });

    const isPep = input.isPepDeclared || hits.some((h) => h.list === 'PEP');
    let riskRating: RiskRating = 'LOW';
    if (input.sourceOfFunds === 'OTHER' || input.incomeBand === 'OVER_5M') riskRating = 'MEDIUM';
    if (isPep || hits.some((h) => h.list === 'SANCTIONS')) riskRating = 'HIGH';
    return { provider: 'mock', riskRating, isPep, hits, screenedAt: new Date().toISOString() };
  }
}

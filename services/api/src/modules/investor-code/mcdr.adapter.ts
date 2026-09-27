/**
 * Boundary to MCDR for unified codes (ADR 0006). Phase 1 uses the manual
 * adapter: every call becomes work for the broker's operations team in the
 * broker console. An electronic adapter can replace it without changing
 * onboarding or order management.
 */
export interface McdrAdapter {
  /** Starts a new unified-code request; returns a submission reference. */
  requestCode(clientId: string): Promise<{ submissionRef: string }>;
  /** Starts verification of a code the client says they already have. */
  verifyExistingCode(clientId: string, code: string): Promise<void>;
}

export const MCDR_ADAPTER = Symbol('MCDR_ADAPTER');

export class ManualMcdrAdapter implements McdrAdapter {
  async requestCode(clientId: string) {
    // The request appears in the broker ops queue (status REQUESTED).
    return { submissionRef: `MANUAL-${clientId}` };
  }

  async verifyExistingCode() {
    // The declared code appears in the broker ops queue (status EXISTING_DECLARED).
  }
}

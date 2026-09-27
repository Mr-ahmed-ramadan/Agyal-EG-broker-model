import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Tenant } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { encryptForTenant } from '../../common/crypto.util';
import { DbService, type Tx } from '../../common/db.service';
import { tenantConfig } from '../../common/tenant-config';
import {
  ageOn,
  decide,
  scoreSuitability,
  type SuitabilityAnswers,
} from '../../domain/onboarding-rules';
import { InvestorCodeService } from '../investor-code/investor-code.service';
import { AML_PROVIDER, EKYC_PROVIDER, type AmlProvider, type EkycProvider } from './providers';

export const ONBOARDING_STEPS = ['IDENTITY', 'PROFILE', 'SUITABILITY', 'UNIFIED_CODE', 'CONSENTS'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const REQUIRED_CONSENTS = ['TERMS', 'RISK_DISCLOSURE', 'PRIVACY_PDPL', 'ESIGN'] as const;

export interface ProfileInput {
  fullNameAr: string;
  address: string;
  occupation: string;
  employer?: string;
  incomeBand: 'UNDER_250K' | '250K_1M' | '1M_5M' | 'OVER_5M';
  sourceOfFunds: 'SALARY' | 'BUSINESS' | 'SAVINGS' | 'INHERITANCE' | 'OTHER';
  isPep: boolean;
  taxResidency: string;
}

const EDITABLE_STATUSES = new Set(['ONBOARDING', 'NEEDS_INFO']);

@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly codes: InvestorCodeService,
    @Inject(EKYC_PROVIDER) private readonly ekyc: EkycProvider,
    @Inject(AML_PROVIDER) private readonly aml: AmlProvider,
  ) {}

  status(tenant: Tenant, clientId: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        include: { onboarding: true, investorCode: true, custodyAccounts: true },
      });
      if (!client) throw new NotFoundException();
      const completed = client.onboarding?.completed ?? [];
      return {
        clientStatus: client.status,
        completedSteps: completed,
        remainingSteps: ONBOARDING_STEPS.filter((s) => !completed.includes(s)),
        decisionNote: client.onboarding?.decisionNote ?? null,
        investorCode: { status: client.investorCode?.status, code: client.investorCode?.code },
        custodyReady: client.custodyAccounts.some((a) => a.active),
        riskProfile: client.riskProfile,
        depositReference: client.depositReference,
      };
    });
  }

  async identity(tenant: Tenant, clientId: string, input: { nationalId: string; fullNameEn: string }) {
    const result = await this.ekyc.verify(input);
    return this.db.forTenant(tenant.id, async (tx) => {
      await this.editable(tx, clientId);
      await tx.client.update({
        where: { id: clientId },
        data: {
          fullNameEn: input.fullNameEn,
          nationalIdEncrypted: encryptForTenant(tenant.id, input.nationalId),
          nationalIdLast4: input.nationalId.slice(-4),
          dateOfBirth: result.dateOfBirth ? new Date(result.dateOfBirth) : null,
        },
      });
      await this.markStep(tx, clientId, 'IDENTITY', {
        ekycResult: result as unknown as Prisma.InputJsonValue,
      });
      return { passed: result.passed, reasons: result.reasons };
    });
  }

  profile(tenant: Tenant, clientId: string, input: ProfileInput) {
    return this.db.forTenant(tenant.id, async (tx) => {
      await this.editable(tx, clientId);
      await tx.client.update({ where: { id: clientId }, data: { fullNameAr: input.fullNameAr } });
      await this.markStep(tx, clientId, 'PROFILE', {
        profile: input as unknown as Prisma.InputJsonValue,
      });
      return { ok: true };
    });
  }

  suitability(tenant: Tenant, clientId: string, answers: SuitabilityAnswers) {
    const riskProfile = scoreSuitability(answers);
    return this.db.forTenant(tenant.id, async (tx) => {
      await this.editable(tx, clientId);
      await tx.client.update({ where: { id: clientId }, data: { riskProfile } });
      await this.markStep(tx, clientId, 'SUITABILITY', {
        suitability: { answers, riskProfile } as unknown as Prisma.InputJsonValue,
      });
      return { riskProfile };
    });
  }

  unifiedCode(tenant: Tenant, clientId: string, input: { hasExistingCode: boolean; code?: string }) {
    return this.db.forTenant(tenant.id, async (tx) => {
      await this.editable(tx, clientId);
      const code = await this.codes.capture(tx, clientId, input);
      await this.markStep(tx, clientId, 'UNIFIED_CODE', {});
      return { status: code.status };
    });
  }

  consents(tenant: Tenant, clientId: string, accepted: string[], ip: string | undefined) {
    const missing = REQUIRED_CONSENTS.filter((c) => !accepted.includes(c));
    if (missing.length) throw new BadRequestException(`Missing consents: ${missing.join(', ')}`);
    return this.db.forTenant(tenant.id, async (tx) => {
      await this.editable(tx, clientId);
      for (const type of REQUIRED_CONSENTS) {
        await tx.consent.create({ data: { tenantId: tenant.id, clientId, type, version: 'v1', ip } });
      }
      await this.markStep(tx, clientId, 'CONSENTS', {});
      return { ok: true };
    });
  }

  /** Runs AML screening and the broker's auto-approval rules (ADR 0005). */
  async submit(tenant: Tenant, clientId: string) {
    const snapshot = await this.db.forTenant(tenant.id, async (tx) => {
      const client = await this.editable(tx, clientId);
      const app = await tx.onboardingApplication.findUniqueOrThrow({ where: { clientId } });
      const missing = ONBOARDING_STEPS.filter((s) => !app.completed.includes(s));
      if (missing.length) throw new BadRequestException(`Complete these steps first: ${missing.join(', ')}`);
      return { client, app };
    });
    const profile = snapshot.app.profile as unknown as ProfileInput;
    const ekyc = snapshot.app.ekycResult as { passed: boolean } | null;
    const amlResult = await this.aml.screen({
      fullNameEn: snapshot.client.fullNameEn ?? '',
      dateOfBirth: snapshot.client.dateOfBirth?.toISOString().slice(0, 10),
      nationalId: snapshot.client.nationalIdLast4 ?? '',
      isPepDeclared: profile.isPep,
      sourceOfFunds: profile.sourceOfFunds,
      incomeBand: profile.incomeBand,
    });
    const decision = decide(tenantConfig(tenant.config).autoApproval, {
      ekycPassed: Boolean(ekyc?.passed),
      riskRating: amlResult.riskRating,
      isPep: amlResult.isPep,
      age: snapshot.client.dateOfBirth ? ageOn(snapshot.client.dateOfBirth, new Date()) : 0,
    });

    return this.db.forTenant(tenant.id, async (tx) => {
      await tx.onboardingApplication.update({
        where: { clientId },
        data: {
          amlResult: amlResult as unknown as Prisma.InputJsonValue,
          submittedAt: new Date(),
          ...(decision.outcome === 'AUTO_APPROVE'
            ? { decisionBy: `auto:${decision.ruleVersion}`, decidedAt: new Date(), decisionNote: null }
            : { decisionNote: decision.reasons.join('; ') }),
        },
      });
      if (decision.outcome === 'AUTO_APPROVE') {
        await this.activate(tx, clientId, amlResult.riskRating);
      } else {
        await tx.client.update({
          where: { id: clientId },
          data: { status: 'PENDING_APPROVAL', riskRating: amlResult.riskRating },
        });
      }
      await this.audit.record(tx, {
        tenantId: tenant.id,
        actorId: null,
        action: decision.outcome === 'AUTO_APPROVE' ? 'CLIENT_AUTO_APPROVED' : 'CLIENT_SENT_TO_REVIEW',
        entity: 'Client',
        entityId: clientId,
        data: decision as unknown as Prisma.InputJsonValue,
      });
      return decision.outcome === 'AUTO_APPROVE'
        ? { status: 'ACTIVE' }
        : { status: 'PENDING_APPROVAL', reasons: decision.reasons };
    });
  }

  // --- Broker compliance (ADR 0005) -----------------------------------------------

  queue(tenant: Tenant) {
    return this.db.forTenant(tenant.id, (tx) =>
      tx.client.findMany({
        where: { status: 'PENDING_APPROVAL' },
        include: { onboarding: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  clients(tenant: Tenant) {
    return this.db.forTenant(tenant.id, (tx) =>
      tx.client.findMany({
        include: { investorCode: true, custodyAccounts: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async decideManually(
    tenant: Tenant,
    actorId: string,
    clientId: string,
    input: { decision: 'APPROVE' | 'REJECT' | 'NEEDS_INFO'; note: string },
  ) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException();
      if (client.status !== 'PENDING_APPROVAL') {
        throw new ConflictException(`Client is ${client.status}, not pending approval`);
      }
      if (input.decision === 'APPROVE') {
        await this.activate(tx, clientId, client.riskRating ?? 'HIGH');
      } else {
        await tx.client.update({
          where: { id: clientId },
          data: { status: input.decision === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO' },
        });
      }
      await tx.onboardingApplication.update({
        where: { clientId },
        data: { decisionBy: actorId, decisionNote: input.note, decidedAt: new Date() },
      });
      await this.audit.record(tx, {
        tenantId: tenant.id,
        actorId,
        action: `CLIENT_${input.decision}`,
        entity: 'Client',
        entityId: clientId,
        data: { note: input.note },
      });
      return { ok: true };
    });
  }

  // --- helpers ------------------------------------------------------------------------

  private async activate(tx: Tx, clientId: string, riskRating: 'LOW' | 'MEDIUM' | 'HIGH') {
    const now = new Date();
    const reviewYears = riskRating === 'LOW' ? 2 : 1;
    await tx.client.update({
      where: { id: clientId },
      data: {
        status: 'ACTIVE',
        riskRating,
        kycApprovedAt: now,
        kycReviewDueAt: new Date(Date.UTC(now.getUTCFullYear() + reviewYears, now.getUTCMonth(), now.getUTCDate())),
      },
    });
  }

  private async editable(tx: Tx, clientId: string) {
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException();
    if (!EDITABLE_STATUSES.has(client.status)) {
      throw new ConflictException(`Onboarding is closed (status ${client.status})`);
    }
    return client;
  }

  private async markStep(
    tx: Tx,
    clientId: string,
    step: OnboardingStep,
    data: Prisma.OnboardingApplicationUpdateInput,
  ) {
    const app = await tx.onboardingApplication.findUniqueOrThrow({ where: { clientId } });
    const completed = app.completed.includes(step) ? app.completed : [...app.completed, step];
    await tx.onboardingApplication.update({ where: { clientId }, data: { ...data, completed } });
    // A client asked for more information goes back to the wizard.
    await tx.client.updateMany({
      where: { id: clientId, status: 'NEEDS_INFO' },
      data: { status: 'ONBOARDING' },
    });
  }
}

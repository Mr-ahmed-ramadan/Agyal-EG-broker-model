import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { DbService } from '../../common/db.service';
import {
  amlFlag,
  daysInQueue,
  isReviewOverdue,
  resolutionProblem,
  type AmlSummary,
  type FlagReason,
  type FlagStatus,
} from '../../domain/compliance-flags';

export interface ClientFilter {
  tenant?: string;
  status?: string;
  aml?: 'PEP' | 'SANCTIONS' | 'ANY';
  overdue?: boolean;
  flagged?: boolean;
  q?: string;
}

/**
 * Agyal's KYC/AML monitoring across all brokers (platform scope). Read only,
 * except raising flags; approval stays with the broker, the licensed party.
 */
@Injectable()
export class MonitoringService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async clients(filter: ClientFilter) {
    return this.db.asSystem(async (tx) => {
      const tenants = await tx.tenant.findMany({ select: { id: true, slug: true, legalNameEn: true, kind: true } });
      const tenantById = new Map(tenants.map((t) => [t.id, t]));
      const tenantId = filter.tenant ? tenants.find((t) => t.slug === filter.tenant)?.id : undefined;
      const q = filter.q?.trim();
      const clients = await tx.client.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          ...(filter.status ? { status: filter.status as never } : {}),
          ...(q
            ? {
                OR: [
                  { fullNameEn: { contains: q, mode: 'insensitive' } },
                  { fullNameAr: { contains: q } },
                  { depositReference: { contains: q.toUpperCase() } },
                  { nationalIdLast4: q },
                ],
              }
            : {}),
        },
        include: { onboarding: true, investorCode: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const flags = await tx.complianceFlag.findMany({ where: { clientId: { in: clients.map((c) => c.id) } }, orderBy: { raisedAt: 'desc' } });
      const users = await tx.user.findMany({ where: { id: { in: clients.map((c) => c.userId) } }, select: { id: true, email: true } });
      const email = new Map(users.map((u) => [u.id, u.email]));
      const now = new Date();

      const rows = clients.map((c) => {
        const ob = c.onboarding;
        const aml = (ob?.amlResult ?? null) as AmlSummary | null;
        const ekyc = (ob?.ekycResult ?? null) as { passed?: boolean; reasons?: string[]; faceMatchScore?: number } | null;
        const mine = flags.filter((f) => f.clientId === c.id);
        return {
          id: c.id,
          broker: { slug: tenantById.get(c.tenantId)?.slug, name: tenantById.get(c.tenantId)?.legalNameEn, kind: tenantById.get(c.tenantId)?.kind },
          name: c.fullNameEn,
          nameAr: c.fullNameAr,
          email: email.get(c.userId) ?? null,
          nationalIdLast4: c.nationalIdLast4,
          status: c.status,
          riskRating: c.riskRating,
          riskProfile: c.riskProfile,
          createdAt: c.createdAt,
          submittedAt: ob?.submittedAt ?? null,
          decidedAt: ob?.decidedAt ?? null,
          decisionBy: ob?.decisionBy ?? null,
          decisionNote: ob?.decisionNote ?? null,
          daysInQueue: daysInQueue(ob?.submittedAt ?? null, ob?.decidedAt ?? null, now),
          ekyc: ekyc ? { passed: !!ekyc.passed, reasons: ekyc.reasons ?? [], faceMatchScore: ekyc.faceMatchScore ?? null } : null,
          aml: aml ? { flag: amlFlag(aml), riskRating: aml.riskRating ?? null, isPep: !!aml.isPep, hits: aml.hits ?? [] } : null,
          unifiedCode: c.investorCode ? { status: c.investorCode.status } : null,
          kycReviewDueAt: c.kycReviewDueAt,
          reviewOverdue: isReviewOverdue(c.kycReviewDueAt, now),
          openFlags: mine.filter((f) => f.status === 'OPEN').length,
          flags: mine,
        };
      });

      const filtered = rows.filter(
        (r) =>
          (!filter.aml || (filter.aml === 'ANY' ? r.aml && r.aml.flag !== 'NONE' : r.aml?.flag === filter.aml)) &&
          (!filter.overdue || r.reviewOverdue) &&
          (!filter.flagged || r.openFlags > 0),
      );
      const kpis = {
        awaitingReview: rows.filter((r) => r.status === 'PENDING_APPROVAL').length,
        needsInfo: rows.filter((r) => r.status === 'NEEDS_INFO').length,
        amlHits: rows.filter((r) => r.aml && r.aml.flag !== 'NONE').length,
        reviewsOverdue: rows.filter((r) => r.reviewOverdue).length,
        openFlags: rows.reduce((s, r) => s + r.openFlags, 0),
        total: rows.length,
      };
      return { kpis, clients: filtered, brokers: tenants.map((t) => ({ slug: t.slug, name: t.legalNameEn })) };
    });
  }

  /** Everything about one client's onboarding: application, consents, flags and the audit trail. */
  async clientDetail(clientId: string) {
    return this.db.asSystem(async (tx) => {
      const c = await tx.client.findUnique({
        where: { id: clientId },
        include: { onboarding: true, investorCode: true, custodyAccounts: true, consents: { orderBy: { acceptedAt: 'asc' } } },
      });
      if (!c) throw new NotFoundException('Client not found');
      const tenant = await tx.tenant.findUnique({ where: { id: c.tenantId }, select: { slug: true, legalNameEn: true } });
      const flags = await tx.complianceFlag.findMany({ where: { clientId }, orderBy: { raisedAt: 'desc' } });
      const audit = await tx.auditLog.findMany({ where: { OR: [{ entityId: clientId }, { entityId: c.userId }] }, orderBy: { createdAt: 'asc' }, take: 200 });
      const { nationalIdEncrypted: _secret, ...client } = c;
      return { client, broker: tenant, flags, audit };
    });
  }

  async raiseFlag(actorId: string, input: { clientId: string; reason: FlagReason; note: string }) {
    return this.db.asSystem(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: input.clientId } });
      if (!client) throw new NotFoundException('Client not found');
      const flag = await tx.complianceFlag.create({
        data: { tenantId: client.tenantId, clientId: client.id, reason: input.reason, note: input.note, raisedById: actorId },
      });
      await this.audit.record(tx, {
        tenantId: client.tenantId,
        actorId,
        action: 'COMPLIANCE_FLAG_RAISED',
        entity: 'Client',
        entityId: client.id,
        data: { flagId: flag.id, reason: input.reason, note: input.note },
      });
      return flag;
    });
  }

  /** Broker: Agyal's flags on its clients, open first. */
  brokerFlags(tenant: Tenant) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const flags = await tx.complianceFlag.findMany({ orderBy: [{ status: 'asc' }, { raisedAt: 'desc' }], take: 200 });
      const clients = await tx.client.findMany({
        where: { id: { in: flags.map((f) => f.clientId) } },
        select: { id: true, fullNameEn: true, fullNameAr: true, status: true, riskRating: true },
      });
      const byId = new Map(clients.map((c) => [c.id, c]));
      return flags.map((f) => ({ ...f, client: byId.get(f.clientId) ?? null }));
    });
  }

  /** Broker: respond to a flag and resolve it. */
  resolveFlag(tenant: Tenant, actorId: string, flagId: string, response: string) {
    return this.db.forTenant(tenant.id, async (tx) => {
      const flag = await tx.complianceFlag.findUnique({ where: { id: flagId } });
      if (!flag) throw new NotFoundException('Flag not found');
      const problem = resolutionProblem(flag.status as FlagStatus, response);
      if (problem) throw new BadRequestException(problem);
      const saved = await tx.complianceFlag.update({
        where: { id: flagId },
        data: { status: 'RESOLVED', brokerResponse: response.trim(), respondedById: actorId, resolvedAt: new Date() },
      });
      await this.audit.record(tx, {
        tenantId: tenant.id,
        actorId,
        action: 'COMPLIANCE_FLAG_RESOLVED',
        entity: 'Client',
        entityId: flag.clientId,
        data: { flagId, response: response.trim() },
      });
      return saved;
    });
  }
}

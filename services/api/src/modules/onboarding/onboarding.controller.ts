import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import {
  Auth,
  CurrentTenant,
  CurrentUser,
  type AppRequest,
  type AuthUser,
} from '../../common/auth';
import { parseBody } from '../../common/validation';
import { OnboardingService } from './onboarding.service';

const IdentitySchema = z.object({
  nationalId: z.string().regex(/^\d{14}$/, 'National ID must be 14 digits'),
  fullNameEn: z.string().min(3),
});

const ProfileSchema = z.object({
  fullNameAr: z.string().min(3),
  address: z.string().min(5),
  occupation: z.string().min(2),
  employer: z.string().optional(),
  incomeBand: z.enum(['UNDER_250K', '250K_1M', '1M_5M', 'OVER_5M']),
  sourceOfFunds: z.enum(['SALARY', 'BUSINESS', 'SAVINGS', 'INHERITANCE', 'OTHER']),
  isPep: z.boolean(),
  taxResidency: z.string().length(2),
});

const answer = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const SuitabilitySchema = z.object({ horizon: answer, lossTolerance: answer, experience: answer });

const UnifiedCodeSchema = z.object({
  hasExistingCode: z.boolean(),
  code: z.string().optional(),
});

const ConsentsSchema = z.object({ accepted: z.array(z.string()) });

const DecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'NEEDS_INFO']),
  note: z.string().min(3),
});

/** Client-facing onboarding wizard (ADR 0005). */
@Controller('onboarding')
@Auth('CLIENT')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  status(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.onboarding.status(t, u.clientId!);
  }

  @Post('identity')
  identity(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.onboarding.identity(t, u.clientId!, parseBody(IdentitySchema, body));
  }

  @Post('profile')
  profile(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.onboarding.profile(t, u.clientId!, parseBody(ProfileSchema, body));
  }

  @Post('suitability')
  suitability(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.onboarding.suitability(t, u.clientId!, parseBody(SuitabilitySchema, body));
  }

  @Post('unified-code')
  unifiedCode(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.onboarding.unifiedCode(t, u.clientId!, parseBody(UnifiedCodeSchema, body));
  }

  @Post('consents')
  consents(
    @CurrentTenant() t: Tenant,
    @CurrentUser() u: AuthUser,
    @Req() req: AppRequest,
    @Body() body: unknown,
  ) {
    return this.onboarding.consents(t, u.clientId!, parseBody(ConsentsSchema, body).accepted, req.ip);
  }

  @Post('submit')
  submit(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.onboarding.submit(t, u.clientId!);
  }
}

/** Broker compliance queue (ADR 0005). */
@Controller('broker')
export class ComplianceController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('clients')
  @Auth('BROKER_COMPLIANCE', 'BROKER_OPS', 'BROKER_ADMIN')
  clients(@CurrentTenant() t: Tenant) {
    return this.onboarding.clients(t);
  }

  @Get('compliance/queue')
  @Auth('BROKER_COMPLIANCE', 'BROKER_ADMIN')
  queue(@CurrentTenant() t: Tenant) {
    return this.onboarding.queue(t);
  }

  @Post('compliance/:clientId/decision')
  @Auth('BROKER_COMPLIANCE', 'BROKER_ADMIN')
  decide(
    @CurrentTenant() t: Tenant,
    @CurrentUser() u: AuthUser,
    @Param('clientId') clientId: string,
    @Body() body: unknown,
  ) {
    return this.onboarding.decideManually(t, u.sub, clientId, parseBody(DecisionSchema, body));
  }
}

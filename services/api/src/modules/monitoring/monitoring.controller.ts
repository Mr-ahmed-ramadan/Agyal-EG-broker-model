import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { FLAG_REASONS } from '../../domain/compliance-flags';
import { MonitoringService } from './monitoring.service';

const FilterSchema = z.object({
  tenant: z.string().optional(),
  status: z.enum(['ONBOARDING', 'PENDING_APPROVAL', 'NEEDS_INFO', 'ACTIVE', 'REJECTED', 'SUSPENDED']).optional(),
  aml: z.enum(['PEP', 'SANCTIONS', 'ANY']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  q: z.string().max(80).optional(),
});
const FlagSchema = z.object({
  clientId: z.string().uuid(),
  reason: z.enum(FLAG_REASONS),
  note: z.string().trim().min(5).max(2000),
});
const ResolveSchema = z.object({ response: z.string().trim().min(5).max(2000) });

@Controller()
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  /** Agyal: every broker's clients with eKYC/AML results, queue age, reviews due and flags. */
  @Get('admin/compliance/clients')
  @Auth('PLATFORM_ADMIN')
  clients(@Query() query: unknown) {
    const f = parseBody(FilterSchema, query);
    return this.monitoring.clients({ ...f, overdue: f.overdue === 'true', flagged: f.flagged === 'true' });
  }

  @Get('admin/compliance/clients/:id')
  @Auth('PLATFORM_ADMIN')
  client(@Param('id') id: string) {
    return this.monitoring.clientDetail(id);
  }

  /** Agyal raises a concern; it lands in the broker's compliance queue. */
  @Post('admin/compliance/flags')
  @Auth('PLATFORM_ADMIN')
  raise(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.monitoring.raiseFlag(u.sub, parseBody(FlagSchema, body));
  }

  @Get('broker/compliance/flags')
  @Auth('BROKER_COMPLIANCE', 'BROKER_ADMIN')
  brokerFlags(@CurrentTenant() t: Tenant) {
    return this.monitoring.brokerFlags(t);
  }

  @Post('broker/compliance/flags/:id/resolve')
  @Auth('BROKER_COMPLIANCE', 'BROKER_ADMIN')
  resolve(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.monitoring.resolveFlag(t, u.sub, id, parseBody(ResolveSchema, body).response);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { DbService } from '../../common/db.service';
import { parseBody } from '../../common/validation';
import { InstrumentsService } from '../instruments/instruments.service';
import { ExperienceService } from './experience.service';

const NewsSchema = z.object({
  titleEn: z.string().trim().min(3).max(140),
  titleAr: z.string().trim().min(3).max(140),
  bodyEn: z.string().trim().min(3).max(2000),
  bodyAr: z.string().trim().min(3).max(2000),
});

const date = z.string().date().optional();
const PeriodSchema = z.object({ from: date, to: date });
const IndicativeSchema = z.object({ offerYield: z.number().gt(0).lt(1) });

@Controller()
export class ExperienceController {
  constructor(
    private readonly experience: ExperienceService,
    private readonly instruments: InstrumentsService,
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  // --- Client ---------------------------------------------------------------------------------

  /** Client home: totals, holdings, upcoming payments, highlights and news. */
  @Get('home')
  @Auth('CLIENT')
  home(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.experience.home(t, u.clientId!);
  }

  /** Client statement for a period (default: this month to date). */
  @Get('statement')
  @Auth('CLIENT')
  statement(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Query() query: unknown) {
    const p = parseBody(PeriodSchema, query);
    return this.experience.statement(t, u.clientId!, p.from, p.to);
  }

  // --- Broker news ----------------------------------------------------------------------------

  @Get('broker/news')
  @Auth('BROKER_ADMIN', 'BROKER_OPS', 'BROKER_COMPLIANCE', 'BROKER_FINANCE', 'BROKER_DEALER')
  brokerNews(@CurrentTenant() t: Tenant) {
    return this.experience.brokerNews(t);
  }

  @Post('broker/news')
  @Auth('BROKER_ADMIN', 'BROKER_OPS')
  async postBrokerNews(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    const saved = await this.experience.postBrokerNews(t, u.sub, parseBody(NewsSchema, body));
    await this.audit.record(this.db, { tenantId: t.id, actorId: u.sub, action: 'NEWS_POSTED', entity: 'Announcement', entityId: saved.id, data: { titleEn: saved.titleEn } });
    return saved;
  }

  @Delete('broker/news/:id')
  @Auth('BROKER_ADMIN', 'BROKER_OPS')
  deleteBrokerNews(@CurrentTenant() t: Tenant, @Param('id') id: string) {
    return this.experience.deleteNews(t, id);
  }

  // --- Agyal admin ----------------------------------------------------------------------------

  @Get('admin/news')
  @Auth('PLATFORM_ADMIN')
  platformNews() {
    return this.experience.platformNews();
  }

  @Post('admin/news')
  @Auth('PLATFORM_ADMIN')
  async postPlatformNews(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    const saved = await this.experience.postPlatformNews(u.sub, parseBody(NewsSchema, body));
    await this.audit.record(this.db, { tenantId: null, actorId: u.sub, action: 'NEWS_POSTED', entity: 'Announcement', entityId: saved.id, data: { titleEn: saved.titleEn } });
    return saved;
  }

  @Delete('admin/news/:id')
  @Auth('PLATFORM_ADMIN')
  deletePlatformNews(@Param('id') id: string) {
    return this.experience.deleteNews(null, id);
  }

  /** Indicative rates for all instruments (bank yields before any broker markup). */
  @Get('admin/indicative-rates')
  @Auth('PLATFORM_ADMIN')
  indicativeRates() {
    return this.db.indicativeRate.findMany();
  }

  @Post('admin/instruments/:isin/indicative')
  @Auth('PLATFORM_ADMIN')
  async setIndicative(@CurrentUser() u: AuthUser, @Param('isin') isin: string, @Body() body: unknown) {
    const { offerYield } = parseBody(IndicativeSchema, body);
    const saved = await this.instruments.setIndicative(isin, offerYield);
    await this.audit.record(this.db, { tenantId: null, actorId: u.sub, action: 'INDICATIVE_RATE_SET', entity: 'Instrument', entityId: isin, data: { offerYield } });
    return saved;
  }
}

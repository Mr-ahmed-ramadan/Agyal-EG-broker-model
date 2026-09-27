import { Controller, Get, Param } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { CurrentTenant } from '../../common/auth';
import { InstrumentsService } from './instruments.service';

/** Public: instruments this broker offers. Prices come from RFQs, not from here. */
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Get()
  list(@CurrentTenant() tenant: Tenant) {
    return this.instruments.list(tenant);
  }

  @Get(':isin')
  one(@CurrentTenant() tenant: Tenant, @Param('isin') isin: string) {
    return this.instruments.byIsin(tenant, isin);
  }
}

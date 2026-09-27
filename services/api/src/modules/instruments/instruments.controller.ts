import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { CurrentTenant } from '../../common/auth';
import { InstrumentsService } from './instruments.service';

/** Public: instruments this broker offers, with indicative rates. Binding prices come from RFQs. */
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Get()
  list(@CurrentTenant() tenant: Tenant) {
    return this.instruments.list(tenant);
  }

  /** Public: what an amount (or nominal) would earn held to maturity, at the indicative rate. */
  @Get(':isin/projection')
  projection(
    @CurrentTenant() tenant: Tenant,
    @Param('isin') isin: string,
    @Query('amount') amount?: string,
    @Query('nominal') nominal?: string,
  ) {
    if ((amount && !/^\d+(\.\d{1,2})?$/.test(amount)) || (nominal && !/^\d+(\.\d{1,2})?$/.test(nominal))) {
      throw new BadRequestException('Amounts must be numbers');
    }
    return this.instruments.projection(tenant, isin, { amount, nominal });
  }

  @Get(':isin')
  one(@CurrentTenant() tenant: Tenant, @Param('isin') isin: string) {
    return this.instruments.byIsin(tenant, isin);
  }
}

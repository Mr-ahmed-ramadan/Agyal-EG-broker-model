import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';

/** Broker markup and commission rules, price snapshots and fee disclosure (ADR 0008). */
@Module({
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}

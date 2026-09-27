import { Module } from '@nestjs/common';
import { BankAdaptersModule } from '../bank-adapters/bank-adapters.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PricingModule } from '../pricing/pricing.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';

/** QuoteRequest / Quote lifecycle across partner banks (ADR 0003). */
@Module({
  imports: [InstrumentsModule, PricingModule, BankAdaptersModule, LedgerModule],
  controllers: [RfqController],
  providers: [RfqService],
  exports: [RfqService],
})
export class RfqModule {}

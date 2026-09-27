import { Module } from '@nestjs/common';
import { BankAdaptersModule } from '../bank-adapters/bank-adapters.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/** FIX order state machine, pre-trade checks, fills to the ledger (ADR 0003). */
@Module({
  imports: [InstrumentsModule, PricingModule, LedgerModule, BankAdaptersModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

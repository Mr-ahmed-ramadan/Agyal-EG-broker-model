import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';

/** Coupons and redemptions (ADR 0007). */
@Module({
  imports: [LedgerModule],
  controllers: [IncomeController],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class IncomeModule {}

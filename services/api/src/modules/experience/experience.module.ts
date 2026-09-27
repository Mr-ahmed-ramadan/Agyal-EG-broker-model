import { Module } from '@nestjs/common';
import { CashModule } from '../cash/cash.module';
import { IncomeModule } from '../income/income.module';
import { InstrumentsModule } from '../instruments/instruments.module';
import { LedgerModule } from '../ledger/ledger.module';
import { EconomicsController } from './economics.controller';
import { ExperienceController } from './experience.controller';
import { ExperienceService } from './experience.service';

/** Client home page, statements, news and indicative rates. */
@Module({
  imports: [LedgerModule, CashModule, IncomeModule, InstrumentsModule],
  controllers: [ExperienceController, EconomicsController],
  providers: [ExperienceService],
})
export class ExperienceModule {}

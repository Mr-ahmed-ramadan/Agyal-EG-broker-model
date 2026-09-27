import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { LedgerModule } from '../ledger/ledger.module';
import { BrokerCashController, ClientCashController } from './cash.controller';
import { CashService } from './cash.service';

/** Settlement with banks, client withdrawals, revenue sweep (ADR 0007). */
@Module({
  imports: [LedgerModule, IdentityModule],
  controllers: [ClientCashController, BrokerCashController],
  providers: [CashService],
})
export class CashModule {}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { TenantMiddleware } from './common/tenant.middleware';
import { HealthController } from './health/health.controller';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { InvestorCodeModule } from './modules/investor-code/investor-code.module';
import { InstrumentsModule } from './modules/instruments/instruments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { RfqModule } from './modules/rfq/rfq.module';
import { OrdersModule } from './modules/orders/orders.module';
import { BankAdaptersModule } from './modules/bank-adapters/bank-adapters.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FixInboxModule } from './modules/fix-inbox/fix-inbox.module';

@Module({
  imports: [
    CommonModule,
    TenancyModule,
    IdentityModule,
    OnboardingModule,
    InvestorCodeModule,
    InstrumentsModule,
    PricingModule,
    RfqModule,
    OrdersModule,
    BankAdaptersModule,
    LedgerModule,
    ReconciliationModule,
    BillingModule,
    AuditModule,
    NotificationsModule,
    FixInboxModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

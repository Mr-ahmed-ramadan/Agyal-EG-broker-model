import { Module } from '@nestjs/common';
import { InvestorCodeModule } from '../investor-code/investor-code.module';
import { ComplianceController, OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AML_PROVIDER, EKYC_PROVIDER, MockAmlProvider, MockEkycProvider } from './providers';

/** Onboarding wizard, eKYC and AML providers, broker compliance queue (ADR 0005). */
@Module({
  imports: [InvestorCodeModule],
  controllers: [OnboardingController, ComplianceController],
  providers: [
    OnboardingService,
    { provide: EKYC_PROVIDER, useClass: MockEkycProvider },
    { provide: AML_PROVIDER, useClass: MockAmlProvider },
  ],
})
export class OnboardingModule {}

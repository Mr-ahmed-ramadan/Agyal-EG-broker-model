import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { OtpService } from './otp.service';
import { OTP_DELIVERY, otpDeliveryFromEnv } from './otp-delivery';

/** Users, roles, two-step sign-in with one-time codes (SMS, or email in the hosted demo) (ADR 0010). */
@Module({
  controllers: [IdentityController],
  providers: [IdentityService, OtpService, { provide: OTP_DELIVERY, useFactory: otpDeliveryFromEnv }],
  exports: [OtpService, IdentityService],
})
export class IdentityModule {}

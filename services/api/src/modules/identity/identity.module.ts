import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { OtpService } from './otp.service';
import { LogSmsProvider, SMS_PROVIDER } from './sms.provider';

/** Users, roles, two-step sign-in with SMS one-time codes (ADR 0010). */
@Module({
  controllers: [IdentityController],
  providers: [IdentityService, OtpService, { provide: SMS_PROVIDER, useClass: LogSmsProvider }],
  exports: [OtpService, IdentityService],
})
export class IdentityModule {}

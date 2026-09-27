import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

/** Users, roles, sessions (ADR 0010). OTP/MFA are a next step. */
@Module({
  controllers: [IdentityController],
  providers: [IdentityService],
})
export class IdentityModule {}

import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AppRequest, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { IdentityService } from './identity.service';

export const EGYPT_MOBILE = /^01[0125]\d{8}$/;

const RegisterSchema = z.object({
  email: z.string().email(),
  mobile: z.string().regex(EGYPT_MOBILE, 'Egyptian mobile number, e.g. 01012345678'),
  password: z.string().min(10),
  fullNameEn: z.string().min(3),
});

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const VerifySchema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });
const ResendSchema = z.object({ challengeId: z.string().uuid() });

/**
 * register / login  -> { challengeId, sentTo, expiresAt }   (code sent by SMS)
 * verify-otp        -> { accessToken, user }
 */
@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  register(@CurrentTenant() tenant: Tenant, @Body() body: unknown) {
    return this.identity.registerClient(tenant, parseBody(RegisterSchema, body));
  }

  @Post('login')
  login(@Req() req: AppRequest, @Body() body: unknown) {
    const { email, password } = parseBody(LoginSchema, body);
    return this.identity.login(req.tenant, email, password);
  }

  @Post('verify-otp')
  verify(@Req() req: AppRequest, @Body() body: unknown) {
    const { challengeId, code } = parseBody(VerifySchema, body);
    return this.identity.verifyOtp(req.tenant, challengeId, code);
  }

  @Post('resend-otp')
  resend(@Req() req: AppRequest, @Body() body: unknown) {
    return this.identity.resend(req.tenant, parseBody(ResendSchema, body).challengeId);
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

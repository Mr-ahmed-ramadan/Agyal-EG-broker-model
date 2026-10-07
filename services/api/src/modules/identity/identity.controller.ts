import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AppRequest, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { EGYPT_MOBILE, normalizeEgyptMobile } from '../../domain/mobile';
import { IdentityService } from './identity.service';

export { EGYPT_MOBILE };

/**
 * A mobile field that takes the number as written and stores the canonical
 * form. Refusing "+20 101 234 5678" was refusing a valid number over its
 * punctuation, which on a sign-up form costs the sign-up.
 */
export const egyptMobile = (message = 'Egyptian mobile number, e.g. 01012345678') =>
  z
    .string()
    .transform((v) => normalizeEgyptMobile(v) ?? v)
    .refine((v) => EGYPT_MOBILE.test(v), message);

const RegisterSchema = z.object({
  email: z.string().email(),
  mobile: egyptMobile(),
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

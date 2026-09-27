import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AppRequest, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { IdentityService } from './identity.service';
import type { Tenant } from '@prisma/client';

const RegisterSchema = z.object({
  email: z.string().email(),
  mobile: z.string().regex(/^01[0125]\d{8}$/, 'Egyptian mobile number, e.g. 01012345678'),
  password: z.string().min(10),
  fullNameEn: z.string().min(3),
});

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

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

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

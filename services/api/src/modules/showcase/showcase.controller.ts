import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AppRequest, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { RateLimiter } from '../../domain/showcase';
import { egyptMobile } from '../identity/identity.controller';
import { ShowcaseService } from './showcase.service';

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  firm: z.string().trim().min(2).max(120),
  role: z.string().trim().max(80).optional(),
  email: z.string().trim().email(),
  mobile: z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, 'Phone number').optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional(),
  /** Honeypot: hidden in the form; bots fill it */
  website: z.string().optional(),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const ProspectSchema = z.object({
  nameEn: z.string().trim().min(2).max(80),
  nameAr: z.string().trim().min(2).max(80),
  logoDataUrl: z.string().max(300_000).optional(),
  primary: hex,
  accent: hex,
  login: z.object({ email: z.string().email(), mobile: egyptMobile('Egyptian mobile number') }).optional(),
});

/** 5 contact submissions per IP per hour. */
const contactLimiter = new RateLimiter(5, 3_600_000);

@Controller()
export class ShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  /** Public: landing-page contact form. */
  @Post('public/contact')
  @HttpCode(202)
  async contact(@Req() req: AppRequest, @Body() body: unknown) {
    const input = parseBody(ContactSchema, body);
    if (input.website) return { received: true }; // bot: accept silently, store nothing
    if (!contactLimiter.allow(req.ip ?? 'unknown')) {
      throw new HttpException('Too many messages; please try again later or email us', HttpStatus.TOO_MANY_REQUESTS);
    }
    const { website: _honeypot, mobile, ...rest } = input;
    return this.showcase.contact({ ...rest, mobile: mobile || undefined }, req.ip);
  }

  @Get('admin/leads')
  @Auth('PLATFORM_ADMIN')
  leads() {
    return this.showcase.leads();
  }

  @Get('admin/prospects')
  @Auth('PLATFORM_ADMIN')
  prospects() {
    return this.showcase.prospects();
  }

  @Post('admin/prospects')
  @Auth('PLATFORM_ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.showcase.createProspect(user.sub, parseBody(ProspectSchema, body));
  }
}

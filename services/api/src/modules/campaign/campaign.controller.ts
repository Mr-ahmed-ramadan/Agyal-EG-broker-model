import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { Auth, type AppRequest } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { AMOUNT_BANDS, CALCULATOR_TENORS, GOVERNORATES, SAVES_IN } from '../../domain/campaign';
import { RateLimiter } from '../../domain/showcase';
import { CampaignService } from './campaign.service';

const CalculateSchema = z.object({
  amount: z.number().positive().max(100_000_000),
  tenorDays: z.union([z.literal(91), z.literal(182), z.literal(273), z.literal(364)]),
  locale: z.enum(['ar', 'en']).default('ar'),
});

const WaitlistSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional().or(z.literal('')),
  mobile: z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, 'Phone number').optional().or(z.literal('')),
  governorate: z.enum(GOVERNORATES).optional(),
  amountBand: z.enum(AMOUNT_BANDS).optional(),
  savesIn: z.enum(SAVES_IN).optional(),
  locale: z.enum(['ar', 'en']).default('ar'),
  /** Must be ticked: we contact people only on explicit consent (Law 151/2020) */
  consent: z.literal(true),
  source: z.string().trim().max(60).optional(),
  campaign: z.string().trim().max(60).optional(),
  /** Honeypot: hidden in the form; bots fill it */
  website: z.string().optional(),
});

const DemoSignupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  locale: z.enum(['ar', 'en']).default('ar'),
  source: z.string().trim().max(60).optional(),
  campaign: z.string().trim().max(60).optional(),
  /** Honeypot: hidden in the form; bots fill it */
  website: z.string().optional(),
});

const DemoSigninSchema = z.object({ email: z.string().trim().email() });

/** 3 demo accounts per IP per hour. */
const demoLimiter = new RateLimiter(3, 3_600_000);
/** 5 sign-in codes per IP per hour. */
const signinLimiter = new RateLimiter(5, 3_600_000);

/** 30 calculations per IP per hour: generous for a visitor, dull for a scraper. */
const calcLimiter = new RateLimiter(30, 3_600_000);
/** 3 waitlist submissions per IP per hour. */
const waitlistLimiter = new RateLimiter(3, 3_600_000);

/**
 * The awareness campaign's public surface. Both endpoints are deliberately
 * unauthenticated and collect no identity: the calculator stores only a demand
 * band, and the waitlist stores intent. No national ID, no documents, no AML
 * screening — that belongs to the licensed broker, later.
 */
@Controller()
export class CampaignController {
  constructor(private readonly campaign: CampaignService) {}

  /** Public: the options the landing page's form and calculator offer. */
  @Get('public/campaign/options')
  options() {
    return {
      amountBands: AMOUNT_BANDS,
      savesIn: SAVES_IN,
      governorates: GOVERNORATES,
      tenors: CALCULATOR_TENORS,
    };
  }

  /** Public: "what would I earn?" — indicative, and never an offer. */
  @Post('public/campaign/calculate')
  @HttpCode(200)
  async calculate(@Req() req: AppRequest, @Body() body: unknown) {
    const input = parseBody(CalculateSchema, body);
    if (!calcLimiter.allow(req.ip ?? 'unknown')) {
      throw new HttpException('Too many calculations; please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.campaign.calculate(input.amount, input.tenorDays, input.locale);
  }

  /** Public: join the waitlist. */
  @Post('public/campaign/waitlist')
  @HttpCode(202)
  async waitlist(@Req() req: AppRequest, @Body() body: unknown) {
    const input = parseBody(WaitlistSchema, body);
    if (input.website) return { joined: true, alreadyOn: false }; // bot: accept silently, store nothing
    if (!waitlistLimiter.allow(req.ip ?? 'unknown')) {
      throw new HttpException('Too many submissions; please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    const { website: _honeypot, consent: _consent, email, mobile, ...rest } = input;
    return this.campaign.joinWaitlist(
      { ...rest, email: email || undefined, mobile: mobile || undefined },
      req.ip,
    );
  }

  /**
   * Public: open a demo account and get a sign-in code by email.
   * Name and email only — no password, no mobile, no national ID, no screening.
   */
  @Post('public/campaign/demo-signup')
  @HttpCode(201)
  async demoSignup(@Req() req: AppRequest, @Body() body: unknown) {
    const input = parseBody(DemoSignupSchema, body);
    // Bot: look successful, create nothing. The challengeId is not a real one.
    if (input.website) return { created: false, sentTo: null, challengeId: null };
    if (!demoLimiter.allow(req.ip ?? 'unknown')) {
      throw new HttpException('Too many demo accounts from here; please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    const { website: _honeypot, ...rest } = input;
    return this.campaign.demoSignup(rest);
  }

  /** Public: send a sign-in code to an existing demo account. */
  @Post('public/campaign/demo-signin')
  @HttpCode(200)
  async demoSignin(@Req() req: AppRequest, @Body() body: unknown) {
    const input = parseBody(DemoSigninSchema, body);
    if (!signinLimiter.allow(req.ip ?? 'unknown')) {
      throw new HttpException('Too many codes requested; please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.campaign.demoSignin(input.email);
  }

  /** Agyal: the demand picture, for broker conversations and the FRA file. */
  @Get('admin/campaign/demand')
  @Auth('PLATFORM_ADMIN')
  demand() {
    return this.campaign.demand();
  }
}

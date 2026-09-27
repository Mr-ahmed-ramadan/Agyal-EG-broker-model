/**
 * End-to-end: onboarding -> unified code -> deposit -> RFQ over FIX to two
 * simulated banks -> accept best quote -> fill -> ledger, a partial sale
 * before maturity, tenant isolation and the manual compliance path.
 *
 * Needs the API, FIX gateway and bank simulator running against a seeded
 * database; `scripts/e2e.sh` at the repo root starts everything.
 */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { withCheckDigit } from '../../src/domain/isin';

const API = process.env.API_URL ?? 'http://localhost:3000';
const PASSWORD = 'Demo-Pass-2026!';
const run = Date.now().toString(36);

type Json = Record<string, any>;

async function call(
  method: string,
  path: string,
  opts: { tenant?: string; token?: string; body?: unknown; expect?: number } = {},
): Promise<Json> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.tenant ? { 'X-Tenant': opts.tenant } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  const expected = opts.expect ?? (method === 'POST' ? 201 : 200);
  if (res.status !== expected) {
    throw new Error(`${method} ${path} -> ${res.status} (expected ${expected}): ${text}`);
  }
  return json;
}

async function waitFor<T>(what: string, fn: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/** Completes the SMS code step using the development echo (OTP_DEV_ECHO=true). */
async function verifyOtp(tenant: string | undefined, challenge: Json): Promise<Json> {
  assert.match(challenge.devCode, /^\d{6}$/, 'dev code echoed');
  assert.equal(challenge.accessToken, undefined, 'no token before the code is verified');
  return call('POST', '/auth/verify-otp', { tenant, body: { challengeId: challenge.challengeId, code: challenge.devCode } });
}

const login = async (tenant: string | undefined, email: string) => {
  const challenge = await call('POST', '/auth/login', { tenant, body: { email, password: PASSWORD } });
  return (await verifyOtp(tenant, challenge)).accessToken as string;
};

async function onboardClient(tenant: string, name: string, nationalId: string, isPep = false) {
  const challenge = await call('POST', '/auth/register', {
    tenant,
    body: { email: `${name.toLowerCase().replace(/\s/g, '.')}.${run}@example.com`, mobile: '01012345678', password: PASSWORD, fullNameEn: name },
  });
  assert.equal(challenge.purpose, 'VERIFY_MOBILE');
  const reg = await verifyOtp(tenant, challenge);
  const token = reg.accessToken as string;
  const o = { tenant, token };
  const idv = await call('POST', '/onboarding/identity', { ...o, body: { nationalId, fullNameEn: name } });
  assert.equal(idv.passed, true, 'eKYC should pass');
  await call('POST', '/onboarding/profile', {
    ...o,
    body: {
      fullNameAr: 'عميل تجريبي', address: '1 Demo Street, Cairo', occupation: 'Engineer',
      incomeBand: '250K_1M', sourceOfFunds: 'SALARY', isPep, taxResidency: 'EG',
    },
  });
  const suit = await call('POST', '/onboarding/suitability', { ...o, body: { horizon: 2, lossTolerance: 2, experience: 2 } });
  assert.equal(suit.riskProfile, 'BALANCED');
  await call('POST', '/onboarding/unified-code', { ...o, body: { hasExistingCode: true, code: '12345678' } });
  await call('POST', '/onboarding/consents', { ...o, body: { accepted: ['TERMS', 'RISK_DISCLOSURE', 'PRIVACY_PDPL', 'ESIGN'] } });
  const submitted = await call('POST', '/onboarding/submit', o);
  return { token, clientId: reg.user.clientId as string, submitted };
}

async function trade(side: 'BUY' | 'SELL', tenant: string, token: string, isin: string, quantity: string) {
  const rfq = await call('POST', '/rfq', { tenant, token, body: { side, isin, quantity } });
  assert.equal(rfq.banks, 2, 'RFQ goes to both partner banks');
  const priced = await waitFor('two bank quotes', async () => {
    const r = await call('GET', `/rfq/${rfq.id}`, { tenant, token });
    return r.quotes.length === 2 ? r : undefined;
  });
  const [best, second] = priced.quotes;
  if (side === 'BUY') assert.ok(Number(best.clientYield) >= Number(second.clientYield), 'best yield first');
  else assert.ok(Number(best.netAmount) >= Number(second.netAmount), 'best proceeds first');
  assert.equal(best.bankCleanPx, undefined, 'bank price is never shown to clients');
  if (side === 'BUY') {
    // The hold-to-maturity view prices exactly what the client pays for this quote.
    assert.equal(best.holdToMaturity.totalCost, best.netAmount, 'projection cost matches the quote');
    assert.ok(best.holdToMaturity.payments.length >= 1);
  } else {
    assert.equal(best.holdToMaturity, null);
  }

  const order = await call('POST', '/orders', { tenant, token, body: { quoteId: best.quoteId } });
  assert.equal(order.ordStatus, 'A', 'PendingNew until the bank acknowledges');
  await call('POST', '/orders', { tenant, token, body: { quoteId: best.quoteId }, expect: 409 });

  const filled = await waitFor('order filled', async () => {
    const o = await call('GET', `/orders/${order.id}`, { tenant, token });
    return o.ordStatus === '2' ? o : undefined;
  });
  return { best, filled };
}

async function main() {
  const T = 'demo-broker';
  // 0. Two-step sign-in: wrong codes are refused and limited; a fresh code works
  const ch = await call('POST', '/auth/login', { tenant: T, body: { email: 'dealer@demo-broker.example', password: PASSWORD } });
  assert.equal(ch.purpose, 'LOGIN');
  assert.equal(ch.sentTo, '•••• 0004');
  const wrong = ch.devCode === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) {
    await call('POST', '/auth/verify-otp', { tenant: T, body: { challengeId: ch.challengeId, code: wrong }, expect: 401 });
  }
  await call('POST', '/auth/verify-otp', { tenant: T, body: { challengeId: ch.challengeId, code: ch.devCode }, expect: 429 });
  await call('POST', '/auth/resend-otp', { tenant: T, body: { challengeId: ch.challengeId }, expect: 429 }); // cooldown
  await call('POST', '/auth/login', { tenant: T, body: { email: 'dealer@demo-broker.example', password: 'wrong-password' }, expect: 401 });
  console.log('✓ SMS code required; wrong codes refused, attempts and resends limited');

  const compliance = await login(T, 'compliance@demo-broker.example');
  const ops = await login(T, 'ops@demo-broker.example');
  const finance = await login(T, 'finance@demo-broker.example');

  // 1. Onboarding with auto-approval
  const c = await onboardClient(T, 'Nour Hassan', '29001011234567');
  assert.equal(c.submitted.status, 'ACTIVE', 'clean client is auto-approved');
  console.log('✓ client onboarded and auto-approved');

  // Cannot trade before custody: RFQ allowed, order blocked later; check status
  let status = await call('GET', '/onboarding', { tenant: T, token: c.token });
  assert.equal(status.custodyReady, false);

  // 2. Broker ops verifies the unified code and opens custody accounts (manual MCDR adapter)
  const tasks = await call('GET', '/broker/investor-codes/tasks', { tenant: T, token: ops });
  assert.ok(Array.isArray(tasks) && tasks.some((t: Json) => t.clientId === c.clientId));
  await call('POST', `/broker/investor-codes/${c.clientId}`, {
    tenant: T,
    token: ops,
    body: {
      code: '12345678',
      custodyAccounts: [
        { depository: 'MCDR', custodian: 'Demo Custodian', accountNumber: 'MCDR-001' },
        { depository: 'CBE', custodian: 'Simulated Bank A', accountNumber: 'CBE-001' },
      ],
    },
  });
  status = await call('GET', '/onboarding', { tenant: T, token: c.token });
  assert.equal(status.investorCode.status, 'VERIFIED');
  console.log('✓ unified code verified and custody accounts linked');

  // 3. Deposit confirmed by broker ops
  await call('POST', '/broker/deposits', {
    tenant: T,
    token: ops,
    body: { depositReference: status.depositReference, amount: '250000.00', bankReference: `TRX-${run}` },
  });
  // Same bank reference again is idempotent
  await call('POST', '/broker/deposits', {
    tenant: T,
    token: ops,
    body: { depositReference: status.depositReference, amount: '250000.00', bankReference: `TRX-${run}` },
  });
  let pf = await call('GET', '/portfolio', { tenant: T, token: c.token });
  assert.equal(pf.cash.available, '250000.00');
  console.log('✓ deposit posted once (idempotent)');

  // 4. Buy a 91-day T-bill via RFQ over FIX
  const instruments = await call('GET', '/instruments', { tenant: T });
  const tbill = instruments.find((i: Json) => i.nameEn.startsWith('91-day'));
  const bond = instruments.find((i: Json) => i.type === 'TREASURY_BOND');
  assert.ok(Number(tbill.indicativeYield) > 0, 'indicative rate shown before any live price');
  assert.equal(tbill.taxRate, 0.2);
  const proj = await call('GET', `/instruments/${tbill.isin}/projection?amount=100000`, { tenant: T });
  assert.ok(Number(proj.totalCost) <= 100000 && Number(proj.totalCost) > 90000, 'largest nominal that fits the amount');
  assert.equal(proj.payments.length, 1);
  assert.equal(proj.payments[0].tax, (Math.round(Number(proj.payments[0].interest) * 20) / 100).toFixed(2), '20% of the discount');
  await call('GET', `/instruments/${tbill.isin}/projection?amount=100`, { tenant: T, expect: 400 }); // below the minimum
  const t1 = await trade('BUY', T, c.token, tbill.isin, '100000');
  assert.equal(t1.filled.executions.length, 2, 'New + Trade execution reports');
  pf = await call('GET', '/portfolio', { tenant: T, token: c.token });
  const spent1 = Number(t1.filled.executions[1].clientAmount);
  assert.equal(pf.cash.reserved, '0.00');
  assert.equal(pf.cash.available, (250000 - spent1).toFixed(2));
  assert.deepEqual(pf.positions, [{ isin: tbill.isin, nominal: '100000.00', reservedForSale: '0.00' }]);
  const admin = await login(undefined, 'admin@agyal.local');
  const rates = await call('GET', '/admin/indicative-rates', { token: admin });
  assert.equal(rates.find((r: Json) => r.isin === tbill.isin).source, 'BANK_QUOTE', 'live bank quotes refresh indicative rates');
  console.log(`✓ T-bill bought over FIX: client yield ${(Number(t1.best.clientYield) * 100).toFixed(3)}%, cost EGP ${spent1}`);

  // 5. Buy a treasury bond (accrued interest, MCDR custody)
  const b1 = await trade('BUY', T, c.token, bond.isin, '5000');
  assert.ok(Number(b1.filled.price.accruedInterest) >= 0);
  pf = await call('GET', '/portfolio', { tenant: T, token: c.token });
  assert.equal(pf.positions.length, 2);
  console.log(`✓ Treasury bond bought: accrued interest EGP ${b1.filled.price.accruedInterest}`);

  // 6. Sell part of the T-bill before maturity; cannot sell more than held
  await call('POST', '/rfq', { tenant: T, token: c.token, body: { side: 'SELL', isin: tbill.isin, quantity: '125000' }, expect: 400 });
  const cashBeforeSale = Number(pf.cash.available);
  const s1 = await trade('SELL', T, c.token, tbill.isin, '50000');
  assert.equal(s1.filled.side, 'SELL');
  const proceeds = Number(s1.filled.executions[1].clientAmount);
  assert.ok(proceeds > 0 && proceeds < 50000, 'discounted proceeds');
  assert.ok(Number(s1.best.clientYield) > Number(t1.best.clientYield), 'client sells at a higher yield than it bought');
  pf = await call('GET', '/portfolio', { tenant: T, token: c.token });
  const tbillPos = pf.positions.find((p: Json) => p.isin === tbill.isin);
  assert.deepEqual(tbillPos, { isin: tbill.isin, nominal: '50000.00', reservedForSale: '0.00' });
  assert.equal(pf.cash.available, (cashBeforeSale + proceeds).toFixed(2));
  console.log(`✓ half the T-bill sold over FIX: client yield ${(Number(s1.best.clientYield) * 100).toFixed(3)}%, proceeds EGP ${proceeds}`);

  // 7. Ledger: every unit nets to zero; broker revenue is positive
  const tb = await call('GET', '/broker/ledger/trial-balance', { tenant: T, token: ops });
  const perUnit = new Map<string, number>();
  for (const r of tb) perUnit.set(r.unit, (perUnit.get(r.unit) ?? 0) + Number(r.rawSum));
  for (const [unit, total] of perUnit) assert.ok(Math.abs(total) < 0.005, `${unit} nets to zero`);
  const revenue = -tb.filter((r: Json) => r.type === 'BROKER_REVENUE').reduce((s: number, r: Json) => s + Number(r.rawSum), 0);
  assert.ok(revenue > 0, 'broker earned markup + commission');
  console.log(`✓ trial balance nets to zero; broker revenue EGP ${revenue.toFixed(2)}`);

  // 8. Cash loop: unsettled proceeds can't leave; settlement; withdrawal with step-up + maker-checker; sweep
  const money = (v: string | number) => Number(v).toFixed(2);
  let cash = await call('GET', '/cash', { tenant: T, token: c.token });
  assert.equal(money(cash.unsettledSaleProceeds), money(proceeds));
  assert.equal(money(cash.withdrawable), money(Number(cash.available) - proceeds));

  // Bank account in the client's own name, added with an SMS step-up code
  const IBAN = 'EG380019000500000000263180002';
  await call('POST', '/bank-accounts', { tenant: T, token: c.token, body: { iban: IBAN, bankName: 'Demo Bank', holderName: 'Someone Else' }, expect: 400 });
  await call('POST', '/bank-accounts', { tenant: T, token: c.token, body: { iban: 'EG380019000500000000263180003', bankName: 'Demo Bank', holderName: 'Nour Hassan' }, expect: 400 });
  const addAcc = await call('POST', '/bank-accounts', { tenant: T, token: c.token, body: { iban: IBAN, bankName: 'Demo Bank', holderName: 'nour hassan' } });
  assert.equal(addAcc.purpose, 'STEP_UP');
  // A step-up code cannot be used to sign in
  await call('POST', '/auth/verify-otp', { tenant: T, body: { challengeId: addAcc.challengeId, code: addAcc.devCode }, expect: 401 });
  const added = await call('POST', '/step-up/confirm', { tenant: T, token: c.token, body: { challengeId: addAcc.challengeId, code: addAcc.devCode } });
  const [acc] = await call('GET', '/bank-accounts', { tenant: T, token: c.token });
  assert.equal(acc.id, added.bankAccountId);
  assert.equal(acc.iban, 'EG38 •••• •••• 0002');

  // Cannot withdraw more than settled cash
  const tooMuch = money(Number(cash.withdrawable) + 1);
  await call('POST', '/withdrawals', { tenant: T, token: c.token, body: { amount: tooMuch, bankAccountId: acc.id }, expect: 400 });

  // Ops confirm settlement of all three orders with the banks; a repeat is a no-op
  const pending = await call('GET', '/broker/settlements', { tenant: T, token: ops });
  assert.equal(pending.length, 3);
  for (const p of pending) {
    const r = await call('POST', `/broker/settlements/${p.orderId}`, { tenant: T, token: ops, body: { reference: `STMT-${p.clOrdId}` } });
    assert.equal(r.amount, p.amount);
  }
  const again = await call('POST', `/broker/settlements/${pending[0].orderId}`, { tenant: T, token: ops, body: { reference: 'dup' } });
  assert.equal(again.alreadySettled, true);
  assert.equal((await call('GET', '/broker/settlements', { tenant: T, token: ops })).length, 0);
  cash = await call('GET', '/cash', { tenant: T, token: c.token });
  assert.equal(cash.unsettledSaleProceeds, '0.00');
  assert.equal(cash.withdrawable, cash.available);
  console.log('✓ settlements confirmed; sale proceeds now withdrawable');

  // Withdrawal requested with a step-up code
  const wStart = await call('POST', '/withdrawals', { tenant: T, token: c.token, body: { amount: '10000.00', bankAccountId: acc.id } });
  const w = await call('POST', '/step-up/confirm', { tenant: T, token: c.token, body: { challengeId: wStart.challengeId, code: wStart.devCode } });
  assert.equal(w.status, 'REQUESTED');
  const cashAfterRequest = await call('GET', '/cash', { tenant: T, token: c.token });
  assert.equal(money(cashAfterRequest.available), money(Number(cash.available) - 10000));
  assert.equal(cashAfterRequest.pendingWithdrawal, '10000.00');
  // The same code cannot be used twice
  await call('POST', '/step-up/confirm', { tenant: T, token: c.token, body: { challengeId: wStart.challengeId, code: wStart.devCode }, expect: 401 });

  // Maker-checker: finance approves, but must not also record the payment
  await call('POST', `/broker/withdrawals/${w.withdrawalId}/paid`, { tenant: T, token: ops, body: { bankReference: 'PAY-1' }, expect: 409 }); // not approved yet
  await call('POST', `/broker/withdrawals/${w.withdrawalId}/approve`, { tenant: T, token: ops, expect: 403 }); // ops cannot approve
  await call('POST', `/broker/withdrawals/${w.withdrawalId}/approve`, { tenant: T, token: finance });
  await call('POST', `/broker/withdrawals/${w.withdrawalId}/paid`, { tenant: T, token: finance, body: { bankReference: 'PAY-1' }, expect: 403 });
  await call('POST', `/broker/withdrawals/${w.withdrawalId}/paid`, { tenant: T, token: ops, body: { bankReference: 'PAY-1' } });
  const [paidW] = await call('GET', '/withdrawals', { tenant: T, token: c.token });
  assert.equal(paidW.status, 'PAID');
  console.log('✓ withdrawal: SMS step-up, finance approved, ops paid (same person refused)');

  // A rejected withdrawal returns the cash
  const w2Start = await call('POST', '/withdrawals', { tenant: T, token: c.token, body: { amount: '500.00', bankAccountId: acc.id } });
  const w2 = await call('POST', '/step-up/confirm', { tenant: T, token: c.token, body: { challengeId: w2Start.challengeId, code: w2Start.devCode } });
  await call('POST', `/broker/withdrawals/${w2.withdrawalId}/reject`, { tenant: T, token: finance, body: { reason: 'Client asked to cancel' } });
  const cashAfterReject = await call('GET', '/cash', { tenant: T, token: c.token });
  assert.equal(cashAfterReject.available, cashAfterRequest.available);
  assert.equal(cashAfterReject.pendingWithdrawal, '0.00');

  // Finance sweeps all earned revenue out of the client-money account
  const rev = await call('GET', '/broker/revenue', { tenant: T, token: finance });
  assert.equal(money(rev.unswept), money(revenue));
  await call('POST', '/broker/revenue/sweep', { tenant: T, token: finance, body: { amount: money(Number(rev.unswept) + 1), bankReference: 'SWEEP-X' }, expect: 400 });
  await call('POST', '/broker/revenue/sweep', { tenant: T, token: finance, body: { amount: rev.unswept, bankReference: 'SWEEP-1' } });

  // The segregated account now holds exactly the clients' money; nothing owed to/by banks
  const tb2 = await call('GET', '/broker/ledger/trial-balance', { tenant: T, token: finance });
  const sum = (type: string) => tb2.filter((r: Json) => r.type === type).reduce((s: number, r: Json) => s + Number(r.rawSum), 0);
  assert.ok(Math.abs(sum('SETTLEMENT_PAYABLE')) < 0.005 && Math.abs(sum('SETTLEMENT_RECEIVABLE')) < 0.005);
  assert.ok(Math.abs(sum('BROKER_REVENUE')) < 0.005);
  const clientMoney = sum('CLIENT_MONEY_BANK');
  const owedToClients = -(sum('CLIENT_CASH_AVAILABLE') + sum('CLIENT_CASH_RESERVED') + sum('CLIENT_CASH_PENDING_WITHDRAWAL'));
  assert.equal(money(clientMoney), money(owedToClients));
  // Independently: deposits - buys paid to banks + sales received from banks - withdrawals paid - revenue swept
  const bankFlows = pending.reduce((s: number, p: Json) => s + (p.side === 'SELL' ? 1 : -1) * Number(p.amount), 0);
  assert.equal(money(clientMoney), money(250000 + bankFlows - 10000 - Number(rev.unswept)));
  console.log(`✓ revenue swept; client-money account EGP ${money(clientMoney)} = cash owed to clients`);


  // 9. Coupons and maturity: admin adds a short-dated bond; client buys; ops confirm coupon then redemption
  const shortIsin = withCheckDigit(`EGS${run.slice(-7).toUpperCase().padStart(7, '0')}1`);
  const maturity = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await call('POST', '/admin/instruments', {
    token: admin,
    body: {
      isin: shortIsin.slice(0, 11) + ((Number(shortIsin[11]) + 1) % 10), type: 'CORPORATE_BOND', issuer: 'Demo Leasing Co.',
      nameEn: 'Short test bond', nameAr: 'سند اختبار قصير', couponRate: '0.24', couponFreq: 12,
      maturityDate: maturity, depository: 'MCDR', minQty: '1000', qtyIncrement: '1000',
    },
    expect: 400, // wrong check digit
  });
  await call('POST', '/admin/instruments', {
    token: admin,
    body: {
      isin: shortIsin, type: 'CORPORATE_BOND', issuer: 'Demo Leasing Co.', nameEn: 'Short test bond', nameAr: 'سند اختبار قصير',
      couponRate: '0.24', couponFreq: 12, maturityDate: maturity, depository: 'MCDR', minQty: '1000', qtyIncrement: '1000',
    },
  });
  await trade('BUY', T, c.token, shortIsin, '10000');
  const cashBeforeIncome = Number((await call('GET', '/cash', { tenant: T, token: c.token })).available);
  const due = (await call('GET', '/broker/income', { tenant: T, token: ops })).filter((e: Json) => e.isin === shortIsin);
  assert.deepEqual(due.map((e: Json) => e.type), ['COUPON', 'REDEMPTION'], 'only the final coupon and redemption (earlier coupons predate the purchase)');
  assert.equal(due[0].totalGross, '200.00'); // 10,000 x 24% / 12
  assert.equal(due[0].totalTax, '40.00'); // 20% of the coupon
  assert.equal(due[1].totalTax, '0.00'); // a bond's redemption returns capital
  assert.equal(due[1].totalGross, '10000.00');
  const conf = (type: string, expect?: number) =>
    call('POST', '/broker/income/confirm', { tenant: T, token: ops, body: { isin: shortIsin, type, paymentDate: maturity, reference: `CUST-${type}` }, expect });
  await conf('REDEMPTION', 409); // final coupon first
  assert.equal((await conf('COUPON')).totalGross, '200.00');
  assert.equal((await conf('COUPON')).alreadyConfirmed, true);
  await conf('REDEMPTION');
  const inc = await call('GET', '/income', { tenant: T, token: c.token });
  assert.deepEqual(inc.received.map((r: Json) => [r.type, r.net]).sort(), [['COUPON', '160.00'], ['REDEMPTION', '10000.00']]);
  assert.equal(inc.upcoming.filter((u: Json) => u.isin === shortIsin).length, 0);
  pf = await call('GET', '/portfolio', { tenant: T, token: c.token });
  assert.ok(!pf.positions.some((p: Json) => p.isin === shortIsin), 'matured bond leaves the portfolio');
  assert.equal(money((await call('GET', '/cash', { tenant: T, token: c.token })).available), money(cashBeforeIncome + 10160));
  const tb3 = await call('GET', '/broker/ledger/trial-balance', { tenant: T, token: finance });
  const perUnit3 = new Map<string, number>();
  for (const r of tb3) perUnit3.set(r.unit, (perUnit3.get(r.unit) ?? 0) + Number(r.rawSum));
  for (const [unit, total] of perUnit3) assert.ok(Math.abs(total) < 0.005, `${unit} nets to zero after income`);
  // Statement and home page reflect the ledger
  const stmt = await call('GET', '/statement?from=2000-01-01', { tenant: T, token: c.token });
  const cashNow = await call('GET', '/cash', { tenant: T, token: c.token });
  assert.equal(stmt.openingBalance, '0.00');
  assert.equal(
    stmt.closingBalance,
    money(Number(cashNow.available) + Number(cashNow.reserved) + Number(cashNow.pendingWithdrawal)),
    'statement closing balance = client cash in the ledger',
  );
  const couponLine = stmt.lines.find((l: Json) => l.kind === 'COUPON' && l.isin === null && l.reference.startsWith(shortIsin));
  assert.ok(couponLine, 'coupon on the statement');
  assert.deepEqual([couponLine.gross, couponLine.tax, couponLine.amount], ['200.00', '40.00', '160.00']);
  assert.equal(stmt.totals.deposits, '250000.00');
  assert.ok(Number(stmt.totals.commissions) > 0);
  assert.ok(stmt.lines.every((l: Json) => l.kind !== 'OTHER'), 'no unexplained lines');
  const home = await call('GET', '/home', { tenant: T, token: c.token });
  pf = await call('GET', '/portfolio', { tenant: T, token: c.token });
  assert.equal(home.holdings.length, pf.positions.length);
  assert.equal(home.totals.incomeReceivedNet, '160.00');
  assert.ok(home.news.length >= 1, 'platform news on the home page');
  console.log('✓ statement reconciles to the ledger; home page shows holdings, income and news');
  console.log('✓ admin-added bond paid its final coupon (EGP 200, EGP 40 tax withheld) and matured (EGP 10,000); position closed');

  // 10. Manual compliance path: a PEP goes to the queue and is approved by compliance
  const pep = await onboardClient(T, 'Minister Example', '28505151234561', true);
  assert.equal(pep.submitted.status, 'PENDING_APPROVAL');
  // Under review: can browse rates and see the home page, but not request prices
  const pendingHome = await call('GET', '/home', { tenant: T, token: pep.token });
  assert.equal(pendingHome.clientStatus, 'PENDING_APPROVAL');
  assert.equal(pendingHome.highlights[0].kind, 'FUND_ACCOUNT');
  await call('POST', '/rfq', { tenant: T, token: pep.token, body: { side: 'BUY', isin: tbill.isin, quantity: '25000' }, expect: 403 });
  const queue = await call('GET', '/broker/compliance/queue', { tenant: T, token: compliance });
  assert.ok(queue.some((q: Json) => q.id === pep.clientId));
  await call('POST', `/broker/compliance/${pep.clientId}/decision`, {
    tenant: T,
    token: compliance,
    body: { decision: 'APPROVE', note: 'Enhanced due diligence completed' },
  });
  status = await call('GET', '/onboarding', { tenant: T, token: pep.token });
  assert.equal(status.clientStatus, 'ACTIVE');
  console.log('✓ PEP routed to compliance queue and approved');

  // 11. Tenant isolation: a second broker cannot see the first broker's data
  const slug = `other-${run}`;
  await call('POST', '/admin/tenants', {
    token: admin,
    body: {
      slug, legalNameEn: 'Other Broker', legalNameAr: 'وسيط آخر',
      branding: {
        displayName: { en: 'Other', ar: 'آخر' }, logoUrl: '',
        colors: { primary: '#333333', primaryContrast: '#ffffff', accent: '#999999' },
        supportEmail: 'support@other.example',
        legalDocuments: { termsUrl: '#', riskDisclosureUrl: '#', privacyUrl: '#' },
      },
    },
  });
  const other = await verifyOtp(
    slug,
    await call('POST', '/auth/register', {
      tenant: slug,
      body: { email: `x.${run}@example.com`, mobile: '01112345678', password: PASSWORD, fullNameEn: 'Other Client' },
    }),
  );
  await call('GET', `/orders/${t1.filled.id}`, { tenant: slug, token: other.accessToken, expect: 404 });
  // A token for one broker is refused on another broker's host
  await call('GET', '/portfolio', { tenant: slug, token: c.token, expect: 403 });

  // Database-level: without a tenant context, RLS hides every tenant row
  const prisma = new PrismaClient();
  try {
    assert.equal(await prisma.order.count(), 0, 'RLS hides orders with no tenant context');
    const tenantId = (await prisma.tenant.findUniqueOrThrow({ where: { slug } })).id;
    const visible = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return tx.order.count();
    });
    assert.equal(visible, 0, 'other tenant sees none of demo-broker orders');
  } finally {
    await prisma.$disconnect();
  }
  console.log('✓ tenant isolation enforced by API and PostgreSQL RLS');

  // 12. Showcase: branded prospect demo and landing-page contact form
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const bigLogo = `data:image/png;base64,${Buffer.alloc(210 * 1024, 7).toString('base64')}`;
  await call('POST', '/admin/prospects', { token: admin, body: { nameEn: 'Big Logo Securities', nameAr: 'شعار كبير', logoDataUrl: bigLogo, primary: '#123456', accent: '#abcdef' }, expect: 400 });
  const prospect = await call('POST', '/admin/prospects', {
    token: admin,
    body: {
      nameEn: `Nile Capital ${run}`, nameAr: 'النيل كابيتال', logoDataUrl: tinyPng, primary: '#f5c518', accent: '#0b4f6c',
      login: { email: `prospect.${run}@example.com`, mobile: '01055555555' },
    },
  });
  assert.match(prospect.slug, /^nile-capital-/);
  assert.ok(prospect.links.clientApp.endsWith(`/?broker=${prospect.slug}`));
  assert.ok(prospect.credentials.temporaryPassword.length >= 12);
  const branded = await call('GET', '/tenant', { tenant: prospect.slug });
  assert.equal(branded.branding.displayName.en, `Nile Capital ${run}`);
  assert.equal(branded.branding.colors.primaryContrast, '#111111', 'dark text on a light brand colour');
  assert.equal((await call('GET', '/instruments', { tenant: prospect.slug })).length >= 6, true);
  const pch = await call('POST', '/auth/login', { tenant: prospect.slug, body: { email: `prospect.${run}@example.com`, password: prospect.credentials.temporaryPassword } });
  const pToken = (await verifyOtp(prospect.slug, pch)).accessToken;
  assert.deepEqual(await call('GET', '/broker/clients', { tenant: prospect.slug, token: pToken }), []);
  assert.ok((await call('GET', '/admin/prospects', { token: admin })).some((p: Json) => p.slug === prospect.slug));
  console.log(`✓ prospect demo "${prospect.slug}" created with branding, bank links and a login`);

  const lead = { name: 'Mona Adel', firm: 'Delta Brokerage', role: 'CEO', email: `mona.${run}@example.com`, mobile: '+20 100 000 0000', message: 'We would like a demo.' };
  await call('POST', '/public/contact', { body: lead, expect: 202 });
  await call('POST', '/public/contact', { body: { ...lead, email: `bot.${run}@example.com`, website: 'http://spam' }, expect: 202 });
  await call('POST', '/public/contact', { body: { ...lead, email: 'not-an-email' }, expect: 400 });
  const leads = await call('GET', '/admin/leads', { token: admin });
  assert.ok(leads.some((l: Json) => l.email === `mona.${run}@example.com`));
  assert.ok(!leads.some((l: Json) => l.email === `bot.${run}@example.com`), 'honeypot submissions are not stored');
  for (let i = 0; i < 4; i++) await call('POST', '/public/contact', { body: lead, expect: 202 });
  await call('POST', '/public/contact', { body: lead, expect: 429 });
  console.log('✓ contact form: lead stored, bot ignored, invalid refused, rate limited');

  console.log('\nAll end-to-end checks passed.');
}

main().catch((err) => {
  console.error('\n✗ E2E FAILED:', err.message);
  process.exit(1);
});

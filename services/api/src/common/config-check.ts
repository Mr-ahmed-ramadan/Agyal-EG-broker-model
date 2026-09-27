/**
 * Fail fast on an unsafe production configuration (ADR 0010). Returns every
 * problem at once so a deploy can be fixed in one go.
 */
export function productionConfigProblems(env: Record<string, string | undefined>): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  const need = (name: string, minLength = 1) => {
    if (!env[name] || env[name]!.length < minLength) {
      problems.push(minLength > 1 ? `${name} must be set (at least ${minLength} characters)` : `${name} must be set`);
    }
  };
  need('DATABASE_URL');
  need('JWT_SECRET', 32);
  need('OTP_SECRET', 32);
  need('KMS_MASTER_KEY_LOCAL', 32);
  need('CORS_ORIGINS');
  if (env.OTP_DELIVERY !== 'resend') {
    problems.push('OTP_DELIVERY must be "resend" in production (no SMS gateway is configured yet)');
  } else {
    need('RESEND_API_KEY');
    need('EMAIL_FROM');
  }
  if (env.OTP_DEV_ECHO === 'true') problems.push('OTP_DEV_ECHO must not be "true" in production');
  return problems;
}

export function assertProductionConfig(env: Record<string, string | undefined> = process.env) {
  const problems = productionConfigProblems(env);
  if (problems.length) {
    throw new Error(`Refusing to start with an unsafe production configuration:\n- ${problems.join('\n- ')}`);
  }
}

import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// --- Passwords (scrypt) ----------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

// --- Per-tenant field encryption (ADR 0002) -------------------------------------
//
// Phase 1: a per-tenant data key is derived from the master key with HKDF, so
// each tenant's personal data is encrypted under a different key. Production
// replaces the local master key with a KMS-wrapped per-tenant data key.

const DEV_MASTER_KEY = Buffer.alloc(32, 7);

function masterKey(): Buffer {
  const configured = process.env.KMS_MASTER_KEY_LOCAL;
  if (configured) {
    // A base64 32-byte key is used as is; any other secret string is hashed to 32 bytes.
    const decoded = Buffer.from(configured, 'base64');
    return decoded.length === 32 ? decoded : createHash('sha256').update(configured).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('KMS_MASTER_KEY_LOCAL must be set in production');
  }
  return DEV_MASTER_KEY;
}

function tenantKey(tenantId: string): Buffer {
  return Buffer.from(hkdfSync('sha256', masterKey(), Buffer.from(tenantId), 'agyal-pii-v1', 32));
}

export function encryptForTenant(tenantId: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tenantKey(tenantId), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decryptForTenant(tenantId: string, payload: string): string {
  const [version, iv, tag, ct] = payload.split(':');
  if (version !== 'v1') throw new Error('Unknown ciphertext version');
  const decipher = createDecipheriv('aes-256-gcm', tenantKey(tenantId), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

/** Short random identifier, e.g. for FIX ClOrdID / QuoteReqID. */
export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString('hex').toUpperCase()}`;
}

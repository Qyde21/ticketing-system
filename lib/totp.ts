import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const CODE_DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder !== 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of cleaned) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** Generates a new random base32 TOTP secret (20 bytes / 160 bits). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, CODE_DIGITS);
  return otp.toString().padStart(CODE_DIGITS, '0');
}

/** Generates the current TOTP code for a given base32 secret. */
export function generateTotpToken(base32Secret: string, forTime: number = Date.now()): string {
  const counter = Math.floor(forTime / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

/**
 * Verifies a 6-digit code against a secret, allowing 1 step of drift in
 * either direction (90 seconds total window) to tolerate clock skew.
 */
export function verifyTotpToken(base32Secret: string, token: string, forTime: number = Date.now()): boolean {
  return findTotpStep(base32Secret, token, forTime) !== null;
}

/**
 * Like verifyTotpToken, but returns the 30-second step number the code
 * matched (or null). Callers that authenticate with the code store the step
 * and refuse anything not strictly newer, so a code can only be used once.
 */
export function findTotpStep(base32Secret: string, token: string, forTime: number = Date.now()): number | null {
  const cleanToken = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return null;

  for (let errorWindow = -1; errorWindow <= 1; errorWindow++) {
    const at = forTime + errorWindow * STEP_SECONDS * 1000;
    const candidate = generateTotpToken(base32Secret, at);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(cleanToken))) {
      return Math.floor(at / 1000 / STEP_SECONDS);
    }
  }
  return null;
}

// ---- Encryption at rest -------------------------------------------------
// A database leak should not hand out everyone's 2FA secrets. When
// TOTP_ENCRYPTION_KEY (32 bytes, base64) is set, secrets are stored as
// AES-256-GCM: "enc:v1:<iv>:<tag>:<ciphertext>" (all base64). Without the key
// they are stored in plaintext as before, and plaintext rows always keep
// working, so this can be rolled out gradually.
const ENC_PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer | null {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  }
  return key;
}

export function isProtectedTotpSecret(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX);
}

/** Encrypt a secret for storage (no-op when no key is configured). */
export function protectTotpSecret(plain: string): string {
  const key = getEncryptionKey();
  if (!key || isProtectedTotpSecret(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + [iv, tag, ct].map((b) => b.toString('base64')).join(':');
}

/** Turn a stored secret (encrypted or legacy plaintext) back into base32. */
export function revealTotpSecret(stored: string): string {
  if (!isProtectedTotpSecret(stored)) return stored;
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('A TOTP secret is encrypted but TOTP_ENCRYPTION_KEY is not set');
  }
  const [ivB64, tagB64, ctB64] = stored.slice(ENC_PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

/** Builds the otpauth:// URI that authenticator apps use to render the QR code. */
export function buildOtpAuthUrl(secret: string, accountLabel: string, issuer = 'TicketHub'): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(CODE_DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Generates human-friendly single-use backup codes (e.g. "AB12-CD34"). */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

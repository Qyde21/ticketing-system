import crypto from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

// HMAC over the entry id, with a fixed prefix so a signature made here can never
// be mistaken for one made by any other feature that also uses JWT_SECRET.
function sign(entryId: string): string {
  return crypto.createHmac('sha256', secret()).update('waitlist-unsubscribe:' + entryId).digest('base64url');
}

/** "<entry id>.<signature>": proves the link came from us, for that one entry only. */
export function waitlistUnsubscribeToken(entryId: string): string {
  return `${entryId}.${sign(entryId)}`;
}

/** Returns the waitlist entry id if the token is genuine, otherwise null. */
export function verifyWaitlistUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length < 38 || token[36] !== '.') return null;
  const id = token.slice(0, 36);
  const given = Buffer.from(token.slice(37));
  if (!UUID_RE.test(id)) return null;
  const expected = Buffer.from(sign(id));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return id.toLowerCase();
}

/** Absolute link for emails. Opens a confirmation page - it does not unsubscribe on a plain GET. */
export function waitlistUnsubscribeUrl(baseUrl: string, entryId: string): string {
  const base = baseUrl.replace(/[\u0000-\u0020\u007f]/g, '').replace(/\/+$/, '');
  return `${base}/waitlist/unsubscribe?token=${encodeURIComponent(waitlistUnsubscribeToken(entryId))}`;
}

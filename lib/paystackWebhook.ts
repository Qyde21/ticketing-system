import crypto from 'crypto';

/**
 * Verify Paystack's x-paystack-signature header (HMAC-SHA512 of the raw body,
 * hex encoded) using a constant-time comparison.
 */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !/^[0-9a-fA-F]{128}$/.test(signature)) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest();
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

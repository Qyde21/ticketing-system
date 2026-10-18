import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Returns true if the request is within the allowed rate, false if it should be blocked.
 * Attempts are tracked per `type` (e.g. 'login', 'forgot_password') so different endpoints
 * don't share the same counter and lock each other out.
 */
export async function checkRateLimit(params: {
  type: string;
  email: string;
  ip: string;
  maxAttempts: number;
  windowMinutes: number;
}): Promise<boolean> {
  await sql`DELETE FROM login_attempts WHERE created_at < now() - interval '1 hour'`;

  const [{ count }] = await sql`
    SELECT COUNT(*) AS count FROM login_attempts
    WHERE type = ${params.type}
    AND (email = ${params.email} OR ip = ${params.ip})
    AND created_at > now() - (${params.windowMinutes} * interval '1 minute')
  `;

  return Number(count) < params.maxAttempts;
}

/**
 * Atomic limiter for credential-guessing endpoints. checkRateLimit() +
 * recordAttempt() count AFTER the password check, so a burst of parallel
 * requests all pass the check before any is recorded (100 parallel guesses
 * against a limit of 10 all got through). consumeAttempt() instead takes a
 * slot BEFORE the credential check with a single UPSERT per key, which
 * Postgres serializes - so at most `maxAttempts` attempts ever run per
 * window. Call releaseAttempt() when the credentials turn out to be valid,
 * so that only failures count against a user.
 *
 * Limits both per email and per IP (blocked if either is over), matching
 * checkRateLimit(). Fixed window of `windowMinutes`.
 */
function bucketKeys(type: string, email: string, ip: string) {
  return [`${type}:e:${email}`, `${type}:i:${ip}`];
}

export async function consumeAttempt(params: {
  type: string;
  email: string;
  ip: string;
  maxAttempts: number;
  windowMinutes: number;
}): Promise<boolean> {
  const [emailKey, ipKey] = bucketKeys(params.type, params.email, params.ip);

  // Opportunistic cleanup so the table doesn't grow forever.
  if (Math.random() < 0.02) {
    await sql`DELETE FROM rate_limit_buckets WHERE window_start < now() - interval '1 day'`;
  }

  const [row] = await sql`
    WITH e AS (
      INSERT INTO rate_limit_buckets (key, count, window_start)
      VALUES (${emailKey}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limit_buckets.window_start <= now() - (${params.windowMinutes} * interval '1 minute')
                     THEN 1 ELSE rate_limit_buckets.count + 1 END,
        window_start = CASE WHEN rate_limit_buckets.window_start <= now() - (${params.windowMinutes} * interval '1 minute')
                            THEN now() ELSE rate_limit_buckets.window_start END
      RETURNING count
    ),
    i AS (
      INSERT INTO rate_limit_buckets (key, count, window_start)
      VALUES (${ipKey}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limit_buckets.window_start <= now() - (${params.windowMinutes} * interval '1 minute')
                     THEN 1 ELSE rate_limit_buckets.count + 1 END,
        window_start = CASE WHEN rate_limit_buckets.window_start <= now() - (${params.windowMinutes} * interval '1 minute')
                            THEN now() ELSE rate_limit_buckets.window_start END
      RETURNING count
    )
    SELECT (SELECT count FROM e) AS email_count, (SELECT count FROM i) AS ip_count
  `;

  return Number(row.email_count) <= params.maxAttempts && Number(row.ip_count) <= params.maxAttempts;
}

/** Give back the slot taken by consumeAttempt() after a successful credential check. */
export async function releaseAttempt(type: string, email: string, ip: string): Promise<void> {
  const keys = bucketKeys(type, email, ip);
  await sql`
    UPDATE rate_limit_buckets SET count = GREATEST(count - 1, 0)
    WHERE key = ANY(${keys}::text[])
  `;
}

export async function recordAttempt(type: string, email: string, ip: string) {
  await sql`INSERT INTO login_attempts (type, email, ip) VALUES (${type}, ${email}, ${ip})`;
}

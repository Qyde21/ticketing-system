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

export async function recordAttempt(type: string, email: string, ip: string) {
  await sql`INSERT INTO login_attempts (type, email, ip) VALUES (${type}, ${email}, ${ip})`;
}

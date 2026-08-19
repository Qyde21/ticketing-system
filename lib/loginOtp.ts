import { createHash, randomInt } from 'crypto';
import { sql } from '@/lib/db';
import { sendLoginOtpEmail } from '@/lib/email';

const OTP_TTL_MINUTES = 10;

function hashOtp(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function issueLoginEmailOtp(user: {
  id: string;
  email: string;
  full_name?: string | null;
} | Record<string, unknown>): Promise<void> {
  const id = String((user as { id: string }).id);
  const email = String((user as { email: string }).email);
  const fullName = (user as { full_name?: string | null }).full_name;

  if (!id || !email || id === 'undefined' || email === 'undefined') {
    throw new Error('issueLoginEmailOtp: user id and email are required');
  }

  const code = generateCode();
  const codeHash = hashOtp(id, code);

  await sql`
    UPDATE login_email_otps
    SET used = true
    WHERE user_id = ${id} AND used = false
  `;

  await sql`
    INSERT INTO login_email_otps (user_id, code_hash, expires_at)
    VALUES (
      ${id},
      ${codeHash},
      now() + (${OTP_TTL_MINUTES} * interval '1 minute')
    )
  `;

  await sendLoginOtpEmail({
    toEmail: email,
    fullName: fullName || undefined,
    code,
  });
}

export async function verifyLoginEmailOtp(userId: string, code: string): Promise<boolean> {
  const clean = String(code).trim();
  if (!/^\d{6}$/.test(clean)) return false;

  const codeHash = hashOtp(userId, clean);
  const rows = await sql`
    SELECT id FROM login_email_otps
    WHERE user_id = ${userId}
      AND code_hash = ${codeHash}
      AND used = false
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) return false;

  await sql`UPDATE login_email_otps SET used = true WHERE id = ${rows[0].id}`;
  return true;
}

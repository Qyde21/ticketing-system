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
}): Promise<void> {
  const code = generateCode();
  const codeHash = hashOtp(user.id, code);

  await sql`
    UPDATE login_email_otps
    SET used = true
    WHERE user_id = ${user.id} AND used = false
  `;

  await sql`
    INSERT INTO login_email_otps (user_id, code_hash, expires_at)
    VALUES (
      ${user.id},
      ${codeHash},
      now() + (${OTP_TTL_MINUTES} * interval '1 minute')
    )
  `;

  await sendLoginOtpEmail({
    toEmail: user.email,
    fullName: user.full_name || undefined,
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

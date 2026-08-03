import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';
import crypto from 'crypto';

const GENERIC_MESSAGE = 'If an unconfirmed account with that email exists, we have sent a new confirmation link.';
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const normalizedEmail = String(email).trim().toLowerCase();

    const allowed = await checkRateLimit({
      type: 'resend_verification',
      email: normalizedEmail,
      ip,
      maxAttempts: MAX_ATTEMPTS,
      windowMinutes: WINDOW_MINUTES,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    await recordAttempt('resend_verification', normalizedEmail, ip);

    const [user] = await sql`
      SELECT id, email, full_name FROM users WHERE email = ${normalizedEmail} AND email_verified = false
    `;

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await sql`DELETE FROM email_verification_tokens WHERE user_id = ${user.id}`;
      await sql`
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
      `;

      const verifyUrl = `${req.nextUrl.origin}/api/auth/verify-email?token=${rawToken}`;

      try {
        await sendVerificationEmail({ toEmail: user.email, fullName: user.full_name, verifyUrl });
      } catch (emailErr) {
        console.error('Failed to send verification email:', emailErr);
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    console.error('Resend verification error:', err);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}

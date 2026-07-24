import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

const GENERIC_MESSAGE = 'If an account with that email exists, we have sent a password reset link.';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [user] = await sql`SELECT id, email FROM users WHERE email = ${normalizedEmail}`;

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;
      await sql`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
      `;

      const resetUrl = `${req.nextUrl.origin}/reset-password?token=${rawToken}`;

      try {
        await sendPasswordResetEmail({ toEmail: user.email, resetUrl });
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr);
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}

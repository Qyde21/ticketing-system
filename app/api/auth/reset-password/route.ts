import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing token or password' }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const [resetToken] = await sql`
      SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token_hash = ${tokenHash}
    `;

    if (!resetToken || new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${resetToken.user_id}`;
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${resetToken.user_id}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

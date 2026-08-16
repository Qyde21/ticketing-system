import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: 'Please enter your password to confirm' }, { status: 400 });
    }

    const [user] = await sql`SELECT password_hash FROM users WHERE id = ${session.userId}`;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    await sql`UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = ${session.userId}`;
    await sql`DELETE FROM totp_backup_codes WHERE user_id = ${session.userId}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('2FA disable error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

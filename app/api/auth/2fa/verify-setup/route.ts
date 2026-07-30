import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { verifyTotpToken, generateBackupCodes, hashBackupCode } from '@/lib/totp';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const [user] = await sql`SELECT totp_secret, totp_enabled FROM users WHERE id = ${session.userId}`;
    if (!user || !user.totp_secret) {
      return NextResponse.json({ error: 'No pending 2FA setup found. Please start setup again.' }, { status: 400 });
    }
    if (user.totp_enabled) {
      return NextResponse.json({ error: 'Two-factor authentication is already enabled.' }, { status: 400 });
    }

    if (!verifyTotpToken(user.totp_secret, String(token))) {
      return NextResponse.json({ error: 'Invalid code. Please check your authenticator app and try again.' }, { status: 400 });
    }

    await sql`UPDATE users SET totp_enabled = true WHERE id = ${session.userId}`;

    // Clear out any old backup codes (e.g. from a previous setup attempt) and issue fresh ones.
    await sql`DELETE FROM totp_backup_codes WHERE user_id = ${session.userId}`;
    const backupCodes = generateBackupCodes();
    for (const code of backupCodes) {
      await sql`
        INSERT INTO totp_backup_codes (user_id, code_hash)
        VALUES (${session.userId}, ${hashBackupCode(code)})
      `;
    }

    return NextResponse.json({ success: true, backupCodes });
  } catch (err) {
    console.error('2FA verify-setup error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

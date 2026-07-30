import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { setSessionCookie, verifyPendingTwoFactorToken } from '@/lib/auth';
import { verifyTotpToken, hashBackupCode } from '@/lib/totp';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const { pendingToken, code } = await req.json();
    if (!pendingToken || !code) {
      return NextResponse.json({ error: 'Missing pending token or code' }, { status: 400 });
    }

    const pending = await verifyPendingTwoFactorToken(pendingToken);
    if (!pending) {
      return NextResponse.json({ error: 'Your session expired. Please log in again.' }, { status: 401 });
    }

    const ip = getClientIp(req);

    const [user] = await sql`SELECT * FROM users WHERE id = ${pending.userId}`;
    if (!user || !user.totp_enabled) {
      return NextResponse.json({ error: 'Two-factor authentication is not enabled for this account.' }, { status: 400 });
    }

    const allowed = await checkRateLimit({
      type: 'login',
      email: user.email,
      ip,
      maxAttempts: MAX_ATTEMPTS,
      windowMinutes: WINDOW_MINUTES,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const cleanCode = String(code).trim();
    let verified = false;

    if (/^\d{6}$/.test(cleanCode)) {
      verified = verifyTotpToken(user.totp_secret, cleanCode);
    } else {
      // Treat as a backup code
      const codeHash = hashBackupCode(cleanCode);
      const [backupCode] = await sql`
        SELECT id FROM totp_backup_codes
        WHERE user_id = ${user.id} AND code_hash = ${codeHash} AND used = false
      `;
      if (backupCode) {
        await sql`UPDATE totp_backup_codes SET used = true WHERE id = ${backupCode.id}`;
        verified = true;
      }
    }

    if (!verified) {
      await recordAttempt('login', user.email, ip);
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ error: 'This account has been suspended. Contact support for help.' }, { status: 403 });
    }

    await setSessionCookie({ userId: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error('2FA login verification error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  setSessionCookie,
  signPendingLoginToken,
  verifyPendingLoginToken,
} from '@/lib/auth';
import { verifyLoginEmailOtp } from '@/lib/loginOtp';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { pendingToken, code } = await req.json();
    if (!pendingToken || !code) {
      return NextResponse.json({ error: 'Missing token or code' }, { status: 400 });
    }

    const pending = await verifyPendingLoginToken(pendingToken, 'login_email_otp');
    if (!pending) {
      return NextResponse.json(
        { error: 'Your login session expired. Please log in again.' },
        { status: 401 }
      );
    }

    const [user] = await sql`SELECT * FROM users WHERE id = ${pending.userId}`;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit({
      type: 'login_otp',
      email: user.email,
      ip,
      maxAttempts: 10,
      windowMinutes: 15,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const ok = await verifyLoginEmailOtp(user.id, code);
    if (!ok) {
      await recordAttempt('login_otp', user.email, ip);
      return NextResponse.json({ error: 'Invalid or expired code. Try again.' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'This account has been suspended. Contact support for help.' },
        { status: 403 }
      );
    }

    if (user.totp_enabled) {
      const nextToken = await signPendingLoginToken(user.id, '2fa_pending', pending.rememberMe);
      return NextResponse.json({ twoFactorRequired: true, pendingToken: nextToken });
    }

    await setSessionCookie(
      { userId: user.id, email: user.email, role: user.role },
      { rememberMe: pending.rememberMe }
    );

    return NextResponse.json({
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error('Verify email OTP error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

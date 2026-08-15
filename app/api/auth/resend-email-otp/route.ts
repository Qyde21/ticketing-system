import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPendingLoginToken } from '@/lib/auth';
import { issueLoginEmailOtp } from '@/lib/loginOtp';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { pendingToken } = await req.json();
    if (!pendingToken) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
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
      type: 'login_otp_resend',
      email: user.email,
      ip,
      maxAttempts: 5,
      windowMinutes: 15,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Please wait a few minutes before requesting another code.' },
        { status: 429 }
      );
    }

    await recordAttempt('login_otp_resend', user.email, ip);
    await issueLoginEmailOtp(user);

    return NextResponse.json({ ok: true, message: 'A new code was sent to your email.' });
  } catch (err) {
    console.error('Resend email OTP error:', err);
    return NextResponse.json({ error: 'Could not resend code. Try again.' }, { status: 503 });
  }
}

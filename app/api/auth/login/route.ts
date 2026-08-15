import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, signPendingLoginToken } from '@/lib/auth';
import { issueLoginEmailOtp } from '@/lib/loginOtp';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email;
    const password = body.password;
    const rememberMe = Boolean(body.rememberMe);

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const normalizedEmail = String(email).trim().toLowerCase();

    const allowed = await checkRateLimit({
      type: 'login',
      email: normalizedEmail,
      ip,
      maxAttempts: MAX_ATTEMPTS,
      windowMinutes: WINDOW_MINUTES,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const [user] = await sql`SELECT * FROM users WHERE email = ${normalizedEmail}`;
    if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      await recordAttempt('login', normalizedEmail, ip);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'This account has been suspended. Contact support for help.' },
        { status: 403 }
      );
    }

    try {
      await issueLoginEmailOtp(user);
    } catch (emailErr) {
      console.error('Failed to send login OTP:', emailErr);
      return NextResponse.json(
        { error: 'Could not send login code. Please try again in a moment.' },
        { status: 503 }
      );
    }

    const pendingToken = await signPendingLoginToken(user.id, 'login_email_otp', rememberMe);

    return NextResponse.json({
      emailOtpRequired: true,
      pendingToken,
      emailHint: maskEmail(user.email),
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

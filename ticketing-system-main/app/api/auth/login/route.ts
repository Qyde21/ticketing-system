import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, setSessionCookie, signPendingLoginToken } from '@/lib/auth';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

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

    if (user.totp_enabled) {
      const pendingToken = await signPendingLoginToken(user.id, '2fa_pending', rememberMe);
      return NextResponse.json({ twoFactorRequired: true, pendingToken });
    }

    await setSessionCookie(
      { userId: user.id, email: user.email, role: user.role },
      { rememberMe }
    );

    return NextResponse.json({
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

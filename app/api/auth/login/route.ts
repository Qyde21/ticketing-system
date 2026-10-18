import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, setSessionCookie, signPendingLoginToken } from '@/lib/auth';
import { consumeAttempt, releaseAttempt, getClientIp } from '@/lib/rateLimit';

// A real bcrypt hash of a throwaway string. Compared against when the account
// doesn't exist (or has no password) so those requests take as long as a real
// wrong-password attempt, and response time can't reveal which emails are registered.
const DUMMY_PASSWORD_HASH =
  '$2b$10$KmxX7Vfbh.519.pfJjisSu2QMbbDy99iq5Rof2ujeRAZY5e0L7x9W';

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

    // Take a slot BEFORE checking the password (atomic), so a burst of
    // parallel guesses can't all slip under the limit. Released on success.
    const allowed = await consumeAttempt({
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
    const passwordOk = await verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !user.password_hash || !passwordOk) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await releaseAttempt('login', normalizedEmail, ip);

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'This account has been suspended. Contact support for help.' },
        { status: 403 }
      );
    }

    // Signup promises "no session until you confirm your email", but nothing
    // enforced it: anyone could register someone else's address and log in as
    // it, seeing every ticket and order bought with that address.
    if (!user.email_verified) {
      return NextResponse.json(
        {
          error:
            'Please confirm your email address before signing in. Check your inbox for the confirmation link.',
          emailNotVerified: true,
        },
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

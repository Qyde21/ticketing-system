import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, setSessionCookie } from '@/lib/auth';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const normalizedEmail = String(email).trim().toLowerCase();

    await sql`DELETE FROM login_attempts WHERE created_at < now() - interval '1 hour'`;

    const [{ count }] = await sql`
      SELECT COUNT(*) AS count FROM login_attempts
      WHERE (email = ${normalizedEmail} OR ip = ${ip})
      AND created_at > now() - (${WINDOW_MINUTES} * interval '1 minute')
    `;
    if (Number(count) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const [user] = await sql`SELECT * FROM users WHERE email = ${normalizedEmail}`;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await sql`INSERT INTO login_attempts (email, ip) VALUES (${normalizedEmail}, ${ip})`;
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ error: 'This account has been suspended. Contact support for help.' }, { status: 403 });
    }

    await setSessionCookie({ userId: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
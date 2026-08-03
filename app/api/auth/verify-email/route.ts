import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import crypto from 'crypto';

// This is a GET route because it's meant to be clicked directly from an email
// link — no JS/fetch involved. On success it logs the user in and redirects
// straight to their dashboard; on failure it redirects to a page explaining why.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?verifyError=missing_token', req.url));
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const [verificationToken] = await sql`
    SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token_hash = ${tokenHash}
  `;

  if (!verificationToken || new Date(verificationToken.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/login?verifyError=expired', req.url));
  }

  const [user] = await sql`
    UPDATE users SET email_verified = true WHERE id = ${verificationToken.user_id}
    RETURNING id, email, role, status
  `;

  await sql`DELETE FROM email_verification_tokens WHERE user_id = ${verificationToken.user_id}`;

  if (!user) {
    return NextResponse.redirect(new URL('/login?verifyError=not_found', req.url));
  }

  if (user.status === 'suspended') {
    return NextResponse.redirect(new URL('/login?verifyError=suspended', req.url));
  }

  await setSessionCookie({ userId: user.id, email: user.email, role: user.role });

  const dashboardPath =
    user.role === 'admin' ? '/admin/dashboard' :
    user.role === 'organizer' ? '/organizer/dashboard' :
    '/attendee/dashboard';

  return NextResponse.redirect(new URL(`${dashboardPath}?verified=true`, req.url));
}

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateTotpSecret, buildOtpAuthUrl } from '@/lib/totp';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Two-factor authentication is only available for organizer and admin accounts' }, { status: 403 });
  }

  const [user] = await sql`SELECT totp_enabled FROM users WHERE id = ${session.userId}`;
  if (user?.totp_enabled) {
    return NextResponse.json({ error: 'Two-factor authentication is already enabled. Disable it first to set up again.' }, { status: 400 });
  }

  const secret = generateTotpSecret();

  // Save the pending secret now (enabled=false) so verify-setup always checks
  // against a server-held value, never one supplied by the client.
  await sql`UPDATE users SET totp_secret = ${secret} WHERE id = ${session.userId}`;

  const otpauthUrl = buildOtpAuthUrl(secret, session.email);

  return NextResponse.json({ secret, otpauthUrl });
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyWaitlistUnsubscribeToken } from '@/lib/waitlistUnsubscribe';

// Removing someone from a waitlist must be a POST, never a plain GET: mail
// scanners and link-preview bots open every link in an email, and a GET that
// unsubscribed would silently remove people who never clicked anything.
// - Browsers: the confirm button on /waitlist/unsubscribe POSTs here.
// - Gmail / Yahoo "unsubscribe" button: POSTs here too (RFC 8058 one-click,
//   announced by the List-Unsubscribe-Post header on the email).
export async function POST(req: NextRequest) {
  const entryId = verifyWaitlistUnsubscribeToken(req.nextUrl.searchParams.get('token'));
  const wantsHtml = (req.headers.get('accept') || '').includes('text/html');

  if (!entryId) {
    if (wantsHtml) return NextResponse.redirect(new URL('/waitlist/unsubscribe?error=1', req.url), 303);
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
  }

  // Idempotent: already removed is still a success.
  await sql`DELETE FROM waitlist_entries WHERE id = ${entryId}`;

  if (wantsHtml) return NextResponse.redirect(new URL('/waitlist/unsubscribe?done=1', req.url), 303);
  return NextResponse.json({ success: true });
}

// Some mail clients open the List-Unsubscribe link with a GET. Send those to the
// confirmation page instead of acting on it.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const target = new URL('/waitlist/unsubscribe', req.url);
  if (token) target.searchParams.set('token', token);
  return NextResponse.redirect(target, 303);
}

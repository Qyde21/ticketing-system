import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { signTicketsMagicLink } from '@/lib/auth';
import { sendTicketsMagicLinkEmail } from '@/lib/email';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email.length > 254) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit({
      type: 'login',
      email,
      ip,
      maxAttempts: 5,
      windowMinutes: 15,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a few minutes.' },
        { status: 429 }
      );
    }
    await recordAttempt('login', email, ip);

    const generic = {
      message:
        'If we have tickets for that email, a secure link is on its way. Check your inbox (and spam).',
    };

    const orders = await sql`
      SELECT id FROM orders
      WHERE LOWER(buyer_email) = ${email}
        AND payment_status = 'paid'
      LIMIT 1
    `;
    if (orders.length === 0) {
      return NextResponse.json(generic);
    }

    const token = await signTicketsMagicLink(email);
    const origin = req.nextUrl.origin;
    const magicUrl = `${origin}/my-tickets/view?token=${encodeURIComponent(token)}`;

    await sendTicketsMagicLinkEmail({ toEmail: email, magicUrl });

    return NextResponse.json(generic);
  } catch (err) {
    console.error('magic-link error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

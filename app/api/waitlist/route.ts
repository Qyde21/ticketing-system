import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendWaitlistConfirmationEmail } from '@/lib/email';
import { consumeAttempt, getClientIp } from '@/lib/rateLimit';
import { waitlistUnsubscribeUrl } from '@/lib/waitlistUnsubscribe';

// Anonymous endpoint that emails whatever address it is given, so it must not
// be usable as a spam relay: per-IP and per-address caps, strict validation.
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const MAX_SIGNUPS_PER_HOUR = 20;

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticketTypeId = body?.ticketTypeId;
    const name = cleanText(body?.name);
    const normalizedEmail = cleanText(body?.email).toLowerCase();

    if (!ticketTypeId || !name || !normalizedEmail) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Name is too long (100 characters max)' }, { status: 400 });
    }
    if (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const allowed = await consumeAttempt({
      type: 'waitlist',
      email: normalizedEmail,
      ip: getClientIp(req),
      maxAttempts: MAX_SIGNUPS_PER_HOUR,
      windowMinutes: 60,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const [ticketType] = await sql`
      SELECT tt.id, tt.name AS ticket_type_name, e.title AS event_title, u.status AS organizer_status
      FROM ticket_types tt
      JOIN events e ON e.id = tt.event_id
      JOIN users u ON u.id = e.organizer_id
      WHERE tt.id = ${ticketTypeId}
    `;

    if (!ticketType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
    }
    if (ticketType.organizer_status === 'suspended') {
      return NextResponse.json({ error: 'This event is not currently available' }, { status: 400 });
    }

    let entryId: string;
    try {
      const [inserted] = await sql`
        INSERT INTO waitlist_entries (ticket_type_id, name, email)
        VALUES (${ticketTypeId}, ${name}, ${normalizedEmail})
        RETURNING id
      `;
      entryId = String(inserted.id);
    } catch (dbErr: any) {
      if (dbErr.message && dbErr.message.includes('duplicate key')) {
        return NextResponse.json({ success: true, message: "You're already on the waitlist for this ticket." });
      }
      throw dbErr;
    }

    try {
      await sendWaitlistConfirmationEmail({
        toEmail: normalizedEmail,
        name,
        eventTitle: ticketType.event_title,
        ticketTypeName: ticketType.ticket_type_name,
        unsubscribeUrl: waitlistUnsubscribeUrl(process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin, entryId),
      });
    } catch (emailErr) {
      console.error('Failed to send waitlist confirmation email:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Waitlist signup error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

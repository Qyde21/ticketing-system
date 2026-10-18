import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { consumeAttempt } from '@/lib/rateLimit';
import { sendTicketTransferredToNewHolderEmail, sendTicketTransferConfirmationEmail } from '@/lib/email';

// Transfers send an email to an address the sender typed, so cap how many one
// account can trigger. Per account (not per IP) so a shared venue/office
// network can't lock out legitimate users.
const MAX_TRANSFERS_PER_HOUR = 10;

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function cleanText(value: unknown): string {
  // Names are typed by the sender and end up in an email: drop control
  // characters (they also break out of subject lines) and trim.
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'You must be logged in to transfer a ticket' }, { status: 401 });
  }

  const { code } = await params;

  try {
    const allowed = await consumeAttempt({
      type: 'ticket_transfer',
      email: session.email.toLowerCase(),
      ip: `user:${session.userId}`,
      maxAttempts: MAX_TRANSFERS_PER_HOUR,
      windowMinutes: 60,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'You have made too many transfers recently. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const newHolderName = cleanText(body?.newHolderName);
    const normalizedNewEmail = cleanText(body?.newHolderEmail).toLowerCase();

    if (!newHolderName || !normalizedNewEmail) {
      return NextResponse.json({ error: 'Recipient name and email are required' }, { status: 400 });
    }
    if (newHolderName.length > 100) {
      return NextResponse.json({ error: 'Recipient name is too long (100 characters max)' }, { status: 400 });
    }
    if (normalizedNewEmail.length > 254 || !EMAIL_RE.test(normalizedNewEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const [ticket] = await sql`
      SELECT t.id, t.ticket_code, t.holder_name, t.holder_email, t.status,
             o.buyer_email, o.buyer_name,
             e.title AS event_title, e.venue_name, e.start_at, e.end_at
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      JOIN events e ON e.id = o.event_id
      WHERE t.ticket_code = ${code}
    `;

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Only whoever CURRENTLY holds the ticket can pass it on. (The original
    // buyer used to stay an owner forever, so they could re-transfer a
    // ticket they had already given away.) Tickets with no holder recorded
    // belong to the buyer.
    const currentHolderEmail = String(ticket.holder_email || ticket.buyer_email).trim().toLowerCase();
    const sessionEmail = session.email.trim().toLowerCase();
    if (currentHolderEmail !== sessionEmail && session.role !== 'admin') {
      return NextResponse.json({ error: 'You are not authorized to transfer this ticket' }, { status: 403 });
    }

    if (ticket.status === 'used') {
      return NextResponse.json({ error: 'This ticket has already been checked in and cannot be transferred' }, { status: 400 });
    }
    if (ticket.status === 'cancelled') {
      return NextResponse.json({ error: 'This ticket has been cancelled and cannot be transferred' }, { status: 400 });
    }

    const eventEnd = ticket.end_at || ticket.start_at;
    if (eventEnd && new Date(eventEnd) < new Date()) {
      return NextResponse.json({ error: 'This event has already ended - the ticket can no longer be transferred' }, { status: 400 });
    }

    if (normalizedNewEmail === currentHolderEmail) {
      return NextResponse.json({ error: 'That ticket is already held by this email address' }, { status: 400 });
    }

    const previousHolderName = ticket.holder_name || ticket.buyer_name;

    // Re-issue the ticket code: otherwise the previous holder keeps a working
    // copy of the QR and can still use it (or sell it again). The update only
    // applies if the ticket is still valid, still has the code and holder we
    // just read, so two simultaneous transfers (or a scan at the same moment)
    // can't both win. The audit row is written by the same statement.
    let newCode: string | null = null;
    for (let attempt = 0; attempt < 3 && !newCode; attempt++) {
      const candidate = nanoid(10).toUpperCase();
      try {
        const rows = await sql`
          WITH upd AS (
            UPDATE tickets
            SET holder_name = ${newHolderName}, holder_email = ${normalizedNewEmail}, ticket_code = ${candidate}
            WHERE id = ${ticket.id}
              AND status = 'valid'
              AND ticket_code = ${ticket.ticket_code}
              AND holder_email IS NOT DISTINCT FROM ${ticket.holder_email ?? null}::text
            RETURNING id, ticket_code
          )
          INSERT INTO ticket_transfers (ticket_id, from_email, from_name, to_email, to_name, old_code, new_code, by_user_id)
          SELECT id, ${currentHolderEmail}, ${previousHolderName}, ${normalizedNewEmail}, ${newHolderName},
                 ${ticket.ticket_code}, ticket_code, ${session.userId}
          FROM upd
          RETURNING new_code
        `;
        if (rows.length === 0) {
          return NextResponse.json(
            { error: 'This ticket was just changed or checked in. Refresh the page and try again.' },
            { status: 409 }
          );
        }
        newCode = String(rows[0].new_code);
      } catch (err: any) {
        if (err?.code === '23505') continue; // new code collided with an existing one - draw another
        throw err;
      }
    }
    if (!newCode) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    try {
      await sendTicketTransferredToNewHolderEmail({
        toEmail: normalizedNewEmail,
        newHolderName,
        fromName: previousHolderName,
        eventTitle: ticket.event_title,
        venueName: ticket.venue_name,
        startAt: ticket.start_at,
        ticketCode: newCode,
        baseUrl: req.nextUrl.origin,
      });
    } catch (emailErr) {
      console.error('Failed to send transfer email to new holder:', emailErr);
    }

    // Confirm to the person who actually gave the ticket up. It carries the
    // OLD (now dead) code only - never the new one, which grants entry.
    try {
      await sendTicketTransferConfirmationEmail({
        toEmail: currentHolderEmail,
        originalHolderName: previousHolderName,
        newHolderName,
        newHolderEmail: normalizedNewEmail,
        eventTitle: ticket.event_title,
        ticketCode: ticket.ticket_code,
      });
    } catch (emailErr) {
      console.error('Failed to send transfer confirmation email:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Ticket transfer error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

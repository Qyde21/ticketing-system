import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Marking a ticket as "shared" doesn't change who holds it (unlike a
// transfer) - the buyer just gave someone else the link/QR. But once
// they've done that, we no longer want it cluttering the buyer's own
// "My Tickets" list, same as a transfer would. This just records that
// it happened; app/attendee/dashboard and app/my-tickets/view both
// filter out tickets with shared_at set.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'You must be logged in to share a ticket' }, { status: 401 });
  }

  const { code } = await params;

  try {
    const [ticket] = await sql`
      SELECT t.id, t.status, t.shared_at, o.buyer_email,
             e.start_at, e.end_at
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      JOIN events e ON e.id = o.event_id
      WHERE t.ticket_code = ${code}
    `;

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isOwner = ticket.buyer_email.toLowerCase() === session.email.toLowerCase();
    if (!isOwner && session.role !== 'admin') {
      return NextResponse.json({ error: 'You are not authorized to share this ticket' }, { status: 403 });
    }

    if (ticket.status === 'used') {
      return NextResponse.json({ error: 'This ticket has already been checked in' }, { status: 400 });
    }
    if (ticket.status === 'cancelled') {
      return NextResponse.json({ error: 'This ticket has been cancelled' }, { status: 400 });
    }

    if (!ticket.shared_at) {
      await sql`UPDATE tickets SET shared_at = NOW() WHERE id = ${ticket.id}`;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Ticket share error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
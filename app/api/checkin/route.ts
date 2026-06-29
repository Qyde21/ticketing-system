import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const { ticketCode, eventId } = await req.json();
    if (!ticketCode || !eventId) {
      return NextResponse.json({ error: 'Missing ticket code or event' }, { status: 400 });
    }

    const [event] = await sql`SELECT id, organizer_id FROM events WHERE id = ${eventId}`;
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let authorized = session.role === 'admin' || event.organizer_id === session.userId;
    if (!authorized) {
      const [staff] = await sql`
        SELECT id FROM event_staff WHERE event_id = ${eventId} AND user_id = ${session.userId}
      `;
      authorized = !!staff;
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
    }

    const [ticket] = await sql`
      SELECT t.id, t.status, t.holder_name, t.checked_in_at, tt.event_id
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.ticket_code = ${ticketCode}
    `;

    if (!ticket) {
      return NextResponse.json({ error: 'Invalid ticket code' }, { status: 404 });
    }
    if (ticket.event_id !== eventId) {
      return NextResponse.json({ error: 'Ticket is for a different event' }, { status: 400 });
    }
    if (ticket.status === 'cancelled') {
      return NextResponse.json({ error: 'Ticket has been cancelled' }, { status: 400 });
    }
    if (ticket.status === 'used') {
      return NextResponse.json(
        {
          error: `Already checked in at ${new Date(ticket.checked_in_at).toLocaleTimeString()}`,
          holderName: ticket.holder_name,
        },
        { status: 409 }
      );
    }

    await sql`
      UPDATE tickets SET status = 'used', checked_in_at = now(), checked_in_by = ${session.userId}
      WHERE id = ${ticket.id}
    `;

    return NextResponse.json({ message: 'Checked in successfully', holderName: ticket.holder_name });
  } catch (err) {
    console.error('Checkin error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
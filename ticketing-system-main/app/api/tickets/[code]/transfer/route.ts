import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendTicketTransferredToNewHolderEmail, sendTicketTransferConfirmationEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'You must be logged in to transfer a ticket' }, { status: 401 });
  }

  const { code } = await params;

  try {
    const { newHolderName, newHolderEmail } = await req.json();

    if (!newHolderName || !newHolderEmail) {
      return NextResponse.json({ error: 'Recipient name and email are required' }, { status: 400 });
    }

    const normalizedNewEmail = String(newHolderEmail).trim().toLowerCase();
    if (!normalizedNewEmail.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const [ticket] = await sql`
      SELECT t.id, t.ticket_code, t.holder_name, t.status,
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

    const isOwner = ticket.buyer_email.toLowerCase() === session.email.toLowerCase();
    if (!isOwner && session.role !== 'admin') {
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

    const previousHolderName = ticket.holder_name || ticket.buyer_name;

    await sql`
      UPDATE tickets SET holder_name = ${newHolderName}, holder_email = ${normalizedNewEmail}
      WHERE id = ${ticket.id}
    `;

    try {
      await sendTicketTransferredToNewHolderEmail({
        toEmail: normalizedNewEmail,
        newHolderName,
        fromName: previousHolderName,
        eventTitle: ticket.event_title,
        venueName: ticket.venue_name,
        startAt: ticket.start_at,
        ticketCode: ticket.ticket_code,
        baseUrl: req.nextUrl.origin,
      });
    } catch (emailErr) {
      console.error('Failed to send transfer email to new holder:', emailErr);
    }

    try {
      await sendTicketTransferConfirmationEmail({
        toEmail: ticket.buyer_email,
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

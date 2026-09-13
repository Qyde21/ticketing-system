import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { finalizePaidOrder } from '@/lib/tickets';
import { nanoid } from 'nanoid';
import { reserveTier, releaseReservation } from '@/lib/reservations';

const MAX_COMP_QUANTITY_PER_REQUEST = 200;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const [event] = await sql`SELECT id, organizer_id, status FROM events WHERE id = ${eventId}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const isOwner = session.userId === event.organizer_id;
  const isAdmin = session.role === 'admin';
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (event.status === 'cancelled') {
    return NextResponse.json({ error: 'This event has been cancelled' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { ticketTypeId, quantity, recipientName, recipientEmail: rawEmail, recipientPhone, note } = body;
  const recipientEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;
  const qty = Number(quantity);

  if (!ticketTypeId || !recipientName || !recipientEmail || !recipientPhone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
  }
  if (qty > MAX_COMP_QUANTITY_PER_REQUEST) {
    return NextResponse.json(
      { error: `Please issue no more than ${MAX_COMP_QUANTITY_PER_REQUEST} complimentary tickets per request` },
      { status: 400 }
    );
  }

  const reservation = await reserveTier(ticketTypeId, qty);
  if (!reservation.ok) {
    return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  }
  if (reservation.reservation.eventId !== eventId) {
    await releaseReservation(reservation.reservation);
    return NextResponse.json({ error: 'That ticket type does not belong to this event' }, { status: 400 });
  }

  try {
    const reference = `comp-${nanoid(16)}`;
    const [order] = await sql`
      INSERT INTO orders (
        event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes,
        discount_amount_kes, payment_status, paystack_reference,
        ticket_type_id, quantity, is_flash_sale, is_complimentary, comp_note
      )
      VALUES (
        ${eventId}, ${recipientName}, ${recipientEmail}, ${recipientPhone}, 0,
        0, 'paid', ${reference},
        ${ticketTypeId}, ${qty}, false, true, ${note || null}
      )
      RETURNING id
    `;

    await finalizePaidOrder(order.id, req.nextUrl.origin);

    if (isAdmin && session.userId !== event.organizer_id) {
      await writeAuditLog({
        actorId: session.userId,
        action: 'event.issue_comp_tickets',
        entityType: 'event',
        entityId: eventId,
        meta: { recipientEmail, quantity: qty, ticketTypeId },
      });
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error('Comp ticket issuance error:', err);
    await releaseReservation(reservation.reservation);
    return NextResponse.json({ error: 'Something went wrong issuing the ticket' }, { status: 500 });
  }
}

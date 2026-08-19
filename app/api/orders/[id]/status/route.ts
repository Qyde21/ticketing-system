import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orders = await sql`
    SELECT o.id, o.payment_status, o.buyer_name, o.quantity,
           e.title AS event_title, e.venue_name, e.start_at, e.end_at, e.cover_image_url
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE o.paystack_reference = ${id}
  `;

  if (!orders.length) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const paid = orders.some((o: any) => o.payment_status === 'paid') ? 'paid' : orders[0].payment_status;
  const orderIds = orders.map((o: any) => o.id);

  let ticketRows: any[] = [];
  if (paid === 'paid') {
    ticketRows = await sql`
      SELECT t.ticket_code, t.holder_name, t.status, t.checked_in_at,
             tt.name AS ticket_type_name,
             e.title AS event_title, e.venue_name, e.start_at, e.end_at, e.cover_image_url
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      JOIN orders o ON o.id = t.order_id
      JOIN events e ON e.id = o.event_id
      WHERE t.order_id = ANY(${orderIds}::uuid[])
      ORDER BY t.ticket_code
    `;
  }

  const first = orders[0];

  return NextResponse.json({
    status: paid,
    ticketCodes: ticketRows.map((t) => t.ticket_code),
    tickets: ticketRows.map((t) => ({
      ticketCode: t.ticket_code,
      holderName: t.holder_name,
      status: t.status,
      checkedInAt: t.checked_in_at,
      ticketTypeName: t.ticket_type_name,
      eventTitle: t.event_title,
      venueName: t.venue_name,
      startAt: t.start_at,
      endAt: t.end_at,
      coverImageUrl: t.cover_image_url,
    })),
    event: {
      title: first.event_title,
      venueName: first.venue_name,
      startAt: first.start_at,
      endAt: first.end_at,
      coverImageUrl: first.cover_image_url,
    },
  });
}

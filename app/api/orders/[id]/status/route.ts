import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [order] = await sql`
    SELECT o.id, o.payment_status, e.title AS event_title
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE o.paystack_reference = ${id}
  `;
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  let rows: any[] = [];
  if (order.payment_status === 'paid') {
    rows = await sql`SELECT ticket_code FROM tickets WHERE order_id = ${order.id}`;
  }

  const tickets = rows.map((t) => ({
    ticketCode: t.ticket_code,
    qrData: t.ticket_code,
    event_title: order.event_title,
  }));

  return NextResponse.json({
    status: order.payment_status,
    ticketCodes: tickets.map((t) => t.ticketCode),
    tickets,
  });
}

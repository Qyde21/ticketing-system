import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [order] = await sql`
    SELECT id, payment_status FROM orders WHERE paystack_reference = ${id}
  `;
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  let tickets: any[] = [];
  if (order.payment_status === 'paid') {
    tickets = await sql`SELECT ticket_code FROM tickets WHERE order_id = ${order.id}`;
  }

  return NextResponse.json({
    status: order.payment_status,
    ticketCodes: tickets.map((t) => t.ticket_code),
  });
}
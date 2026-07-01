import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { refundTransaction } from '@/lib/paystack';
import { sendCancellationEmail } from '@/lib/email';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  const [event] = await sql`SELECT id, title, organizer_id FROM events WHERE id = ${id}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
  }

  const paidOrders = await sql`
    SELECT id, paystack_reference, buyer_name, buyer_email
    FROM orders WHERE event_id = ${id} AND payment_status = 'paid'
  `;

  for (const order of paidOrders) {
    try {
      await refundTransaction(order.paystack_reference);
      await sql`UPDATE orders SET payment_status = 'refunded' WHERE id = ${order.id}`;
      await sql`UPDATE tickets SET status = 'cancelled' WHERE order_id = ${order.id}`;
      await sendCancellationEmail({
        toEmail: order.buyer_email,
        buyerName: order.buyer_name,
        eventTitle: event.title,
        reason: 'The event has been cancelled by the organizer.',
      });
    } catch (err) {
      console.error(`Failed to refund order ${order.id}:`, err);
    }
  }

  await sql`UPDATE events SET status = 'cancelled', updated_at = now() WHERE id = ${id}`;

  return NextResponse.json({ success: true, refundedOrders: paidOrders.length });
}

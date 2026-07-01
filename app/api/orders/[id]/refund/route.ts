import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { refundTransaction } from '@/lib/paystack';
import { sendCancellationEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  const [order] = await sql`
    SELECT o.id, o.payment_status, o.paystack_reference, o.buyer_name, o.buyer_email,
           e.title AS event_title, e.organizer_id
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE o.id = ${id}
  `;

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this order' }, { status: 403 });
  }
  if (order.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Only paid orders can be refunded' }, { status: 400 });
  }

  try {
    await refundTransaction(order.paystack_reference);
  } catch (err: any) {
    console.error('Paystack refund error:', err);
    return NextResponse.json({ error: err.message || 'Refund failed at Paystack' }, { status: 500 });
  }

  await sql`UPDATE orders SET payment_status = 'refunded' WHERE id = ${order.id}`;
  await sql`UPDATE tickets SET status = 'cancelled' WHERE order_id = ${order.id}`;

  try {
    await sendCancellationEmail({
      toEmail: order.buyer_email,
      buyerName: order.buyer_name,
      eventTitle: order.event_title,
      reason: 'Your order has been refunded by the organizer.',
    });
  } catch (emailErr) {
    console.error('Failed to send cancellation email:', emailErr);
  }

  return NextResponse.json({ success: true });
}

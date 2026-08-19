import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { refundTransaction } from '@/lib/paystack';
import { sendCancellationEmail } from '@/lib/email';
import { notifyWaitlistIfSpotsFreed } from '@/lib/waitlist';
import { writeAuditLog } from '@/lib/audit';
import { isEventEnded } from '@/lib/eventStatus';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  const [order] = await sql`
    SELECT o.id, o.payment_status, o.paystack_reference, o.buyer_name, o.buyer_email,
           o.ticket_type_id, o.quantity, o.is_flash_sale, o.total_amount_kes,
           e.title AS event_title, e.organizer_id, e.start_at, e.end_at, e.status AS event_status
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
  if (
    isEventEnded({
      status: order.event_status,
      start_at: order.start_at,
      end_at: order.end_at,
    })
  ) {
    return NextResponse.json(
      { error: 'This event has ended. Refunds are closed.' },
      { status: 400 }
    );
  }

  let refundAmountKes: number | undefined;
  if (order.paystack_reference) {
    const siblings = await sql`
      SELECT id FROM orders
      WHERE paystack_reference = ${order.paystack_reference}
        AND payment_status = 'paid'
    `;
    if (siblings.length > 1) {
      refundAmountKes = Number(order.total_amount_kes) || 0;
    }
  }

  const [claimed] = await sql`
    UPDATE orders SET payment_status = 'refunded'
    WHERE id = ${id} AND payment_status = 'paid'
    RETURNING id
  `;
  if (!claimed) {
    return NextResponse.json({ error: 'Only paid orders can be refunded' }, { status: 400 });
  }

  try {
    if (order.paystack_reference) {
      await refundTransaction(order.paystack_reference, refundAmountKes);
    }
  } catch (err: any) {
    console.error('Paystack refund error:', err);
    await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${id}`;
    return NextResponse.json({ error: err.message || 'Refund failed at Paystack' }, { status: 500 });
  }

  await sql`UPDATE tickets SET status = 'cancelled' WHERE order_id = ${order.id}`;
  await sql`
    UPDATE ticket_types
    SET quantity_sold = GREATEST(0, quantity_sold - ${order.quantity}),
        flash_sale_quantity_sold = GREATEST(
          0,
          flash_sale_quantity_sold - ${order.is_flash_sale ? order.quantity : 0}
        )
    WHERE id = ${order.ticket_type_id}
  `;

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

  try {
    await notifyWaitlistIfSpotsFreed(order.ticket_type_id, order.quantity, req.nextUrl.origin);
  } catch (wErr) {
    console.error('Waitlist notify failed:', wErr);
  }

  
  await writeAuditLog({
    actorId: session.userId,
    action: 'order.refund',
    entityType: 'order',
    entityId: order.id,
    meta: { eventTitle: order.event_title },
  });
  return NextResponse.json({ success: true });
}

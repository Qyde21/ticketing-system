import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
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

  const [event] = await sql`SELECT id, title, organizer_id, status FROM events WHERE id = ${id}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
  }
  if (event.status === 'cancelled') {
    return NextResponse.json({ error: 'Event is already cancelled' }, { status: 400 });
  }

  const paidOrders = await sql`
    SELECT id, paystack_reference, buyer_name, buyer_email,
           ticket_type_id, quantity, is_flash_sale, total_amount_kes
    FROM orders
    WHERE event_id = ${id} AND payment_status = 'paid'
  `;

  // Group by Paystack reference so one charge is not refunded multiple times
  const byRef = new Map<string, typeof paidOrders>();
  const noRef: typeof paidOrders = [];
  for (const order of paidOrders as any[]) {
    const ref = order.paystack_reference as string | null;
    if (!ref) {
      noRef.push(order);
      continue;
    }
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref)!.push(order);
  }

  let refundedOrders = 0;
  const failed: { orderId: string; error: string }[] = [];

  async function settleLocal(order: any) {
    await sql`UPDATE orders SET payment_status = 'refunded' WHERE id = ${order.id} AND payment_status = 'paid'`;
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
        eventTitle: event.title,
        reason: 'The event has been cancelled by the organizer.',
      });
    } catch (emailErr) {
      console.error('Cancel email failed', order.id, emailErr);
    }
    refundedOrders += 1;
  }

  for (const [ref, orders] of byRef) {
    try {
      // Full refund of the original charge (covers all lines on that reference)
      await refundTransaction(ref);
      for (const order of orders as any[]) {
        await settleLocal(order);
      }
    } catch (err: any) {
      console.error(`Failed to refund Paystack ref ${ref}:`, err);
      for (const order of orders as any[]) {
        failed.push({ orderId: order.id, error: err?.message || 'Paystack refund failed' });
      }
    }
  }

  for (const order of noRef as any[]) {
    try {
      // Free / zero-ref paid rows — local settle only
      await settleLocal(order);
    } catch (err: any) {
      failed.push({ orderId: order.id, error: err?.message || 'Local refund failed' });
    }
  }

  await sql`UPDATE events SET status = 'cancelled', updated_at = now() WHERE id = ${id}`;

  revalidateTag('events', 'max');
  return NextResponse.json({
    success: true,
    refundedOrders,
    failedCount: failed.length,
    failed,
  });
}

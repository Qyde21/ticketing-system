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

  // Atomically claim the event for cancellation first. If a duplicate/
  // concurrent cancel request comes in (double-click, retry), only one
  // wins this claim — the other is told the event is already cancelled
  // instead of re-processing (and re-refunding) the same set of orders.
  // This is the primary defense; the per-order/per-reference claims below
  // are defense in depth in case some other path touches the same orders.
  const [claimedEvent] = await sql`
    UPDATE events SET status = 'cancelled', updated_at = now()
    WHERE id = ${id} AND status != 'cancelled'
    RETURNING id
  `;
  if (!claimedEvent) {
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

  // Handles tickets/inventory/email for an order whose payment_status has
  // ALREADY been atomically claimed to 'refunded' by the caller — this
  // function does not touch orders.payment_status itself.
  async function settleClaimedOrder(order: any) {
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
    const ids = (orders as any[]).map((o) => o.id);

    // Atomically claim every order sharing this Paystack reference before
    // calling Paystack. Only orders still 'paid' at the moment this UPDATE
    // applies get claimed — if some other process already touched one
    // (e.g. a concurrent single-order refund), it's excluded here rather
    // than being refunded a second time.
    const claimed = await sql`
      UPDATE orders SET payment_status = 'refunded'
      WHERE id = ANY(${ids}) AND payment_status = 'paid'
      RETURNING id
    `;
    const claimedIds = new Set(claimed.map((c: any) => c.id as string));
    const claimedOrders = (orders as any[]).filter((o) => claimedIds.has(o.id));

    if (claimedOrders.length === 0) continue; // nothing left to do for this reference

    try {
      // Full refund of the original charge (covers all lines on that reference)
      await refundTransaction(ref);
      for (const order of claimedOrders) {
        await settleClaimedOrder(order);
      }
    } catch (err: any) {
      console.error(`Failed to refund Paystack ref ${ref}:`, err);
      // Roll back the claim for these specific orders so they stay
      // retriable rather than being stuck showing "refunded" when
      // Paystack never actually processed the charge.
      await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ANY(${claimedOrders.map((o) => o.id)})`;
      for (const order of claimedOrders) {
        failed.push({ orderId: order.id, error: err?.message || 'Paystack refund failed' });
      }
    }
  }

  for (const order of noRef as any[]) {
    // Free / zero-ref paid rows — no Paystack call needed, but still claim
    // atomically before touching tickets/inventory so a concurrent path
    // can't double-decrement the same order's inventory.
    const [claimed] = await sql`
      UPDATE orders SET payment_status = 'refunded'
      WHERE id = ${order.id} AND payment_status = 'paid'
      RETURNING id
    `;
    if (!claimed) continue;

    try {
      await settleClaimedOrder(order);
    } catch (err: any) {
      failed.push({ orderId: order.id, error: err?.message || 'Local refund failed' });
    }
  }

  revalidateTag('events', 'max');
  return NextResponse.json({
    success: true,
    refundedOrders,
    failedCount: failed.length,
    failed,
  });
}

import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendTicketEmail, sendCancellationEmail } from '@/lib/email';
import { refundTransaction } from '@/lib/paystack';
import { sendTicketConfirmationSms } from '@/lib/sms';
import { awardPointsForOrder } from '@/lib/loyalty';

export type TicketDisplayStatus = 'valid' | 'used' | 'cancelled' | 'expired';

/**
 * Tickets never get their DB status flipped when an event ends unscanned -
 * the row stays 'valid' forever (this is intentional, see finalizePaidOrder).
 * Anywhere a ticket's status is shown to a person, use this to derive what
 * they should actually see: an unscanned 'valid' ticket on an event that has
 * already ended should read as 'expired', not 'valid'.
 */
export function getTicketDisplayStatus(
  ticketStatus: string | null | undefined,
  event: { status?: string | null; start_at?: string | Date | null; end_at?: string | Date | null } | null | undefined
): TicketDisplayStatus {
  if (ticketStatus === 'used' || ticketStatus === 'cancelled') {
    return ticketStatus;
  }
  if (event) {
    const ended =
      event.status === 'completed' ||
      (event.status !== 'cancelled' &&
        (() => {
          const end = event.end_at ? new Date(event.end_at) : event.start_at ? new Date(event.start_at) : null;
          return end ? end < new Date() : false;
        })());
    if (ended) return 'expired';
  }
  return 'valid';
}

type LatePaymentOutcome = 'claimed' | 'lost' | 'refund';

/**
 * A payment arrived for an order the expiry cron already marked 'expired'
 * (it releases the seats after 30 minutes, but Paystack pages and M-Pesa
 * prompts can still be paid later). Re-reserve the seats and mark the order
 * paid in ONE atomic statement - either both happen or neither does, and the
 * row lock on the order means concurrent callers (webhook + verify redirect)
 * can't both reserve. Returns:
 *  - 'claimed': seats re-reserved, order is now 'paid' - caller issues tickets
 *  - 'lost':    another caller already handled this order
 *  - 'refund':  seats are gone (sold out), the event was cancelled/ended, or
 *               the ticket type no longer exists - the buyer must be refunded
 */
async function reclaimExpiredOrder(order: any): Promise<LatePaymentOutcome> {
  const qty = Number(order.quantity) || 0;
  const [tt] = await sql`
    SELECT flash_sale_price_kes FROM ticket_types WHERE id = ${order.ticket_type_id}
  `;
  const [ev] = await sql`
    SELECT status, start_at, end_at FROM events WHERE id = ${order.event_id}
  `;
  if (!tt || !ev || qty < 1) return 'refund';
  if (ev.status === 'cancelled' || ev.status === 'completed') return 'refund';
  const endsAt = ev.end_at ? new Date(ev.end_at) : ev.start_at ? new Date(ev.start_at) : null;
  if (endsAt && endsAt < new Date()) return 'refund';

  // Same flash-sale detection the expiry cron used when it released the seats,
  // so the flash counter is restored symmetrically.
  const lineGross = Number(order.total_amount_kes || 0) + Number(order.discount_amount_kes || 0);
  const unitPrice = lineGross / qty;
  const flashPrice = tt.flash_sale_price_kes != null ? Number(tt.flash_sale_price_kes) : null;
  const flashApplied =
    flashPrice != null && Number.isFinite(unitPrice) && Math.abs(unitPrice - flashPrice) < 0.02;

  const reserved = await sql`
    WITH locked AS (
      SELECT id FROM orders
      WHERE id = ${order.id} AND payment_status = 'expired'
      FOR UPDATE
    ),
    reserve AS (
      UPDATE ticket_types
      SET quantity_sold = quantity_sold + ${qty},
          flash_sale_quantity_sold = flash_sale_quantity_sold + ${flashApplied ? qty : 0}
      WHERE id = ${order.ticket_type_id}
        AND EXISTS (SELECT 1 FROM locked)
        AND quantity_sold + ${qty} <= quantity_total
      RETURNING id
    )
    UPDATE orders SET payment_status = 'paid'
    WHERE id IN (SELECT id FROM locked) AND EXISTS (SELECT 1 FROM reserve)
    RETURNING id
  `;
  if (reserved.length > 0) return 'claimed';

  // No row: either someone else got there first, or there are no seats left.
  const [current] = await sql`SELECT payment_status FROM orders WHERE id = ${order.id}`;
  return current?.payment_status === 'expired' ? 'refund' : 'lost';
}

/**
 * Refund a payment that can't be honoured with tickets. Marks the order
 * 'refunded' first (so exactly one caller refunds), then calls Paystack. If
 * Paystack fails, the order goes back to 'expired' and the error is rethrown:
 * the webhook then returns 500 and Paystack retries it later, which retries
 * the refund. Only this order's amount is refunded, since one Paystack
 * reference can cover several orders in a multi-tier cart.
 */
async function refundLatePayment(order: any): Promise<void> {
  const [marked] = await sql`
    UPDATE orders SET payment_status = 'refunded'
    WHERE id = ${order.id} AND payment_status = 'expired'
    RETURNING id
  `;
  if (!marked) return;

  try {
    if (!order.paystack_reference) throw new Error('Order has no Paystack reference to refund');
    await refundTransaction(order.paystack_reference as string, Number(order.total_amount_kes));
  } catch (err) {
    await sql`
      UPDATE orders SET payment_status = 'expired'
      WHERE id = ${order.id} AND payment_status = 'refunded'
    `;
    console.error('Late-payment refund failed - will retry on webhook retry', order.id, err);
    throw err;
  }

  try {
    const [ev] = await sql`SELECT title FROM events WHERE id = ${order.event_id}`;
    await sendCancellationEmail({
      toEmail: order.buyer_email,
      buyerName: order.buyer_name,
      eventTitle: ev?.title || 'your event',
      reason:
        'Your payment reached us after your 30-minute reservation window had closed, and these tickets are no longer available.',
    });
  } catch (emailErr) {
    console.error('Failed to send late-payment refund email', order.id, emailErr);
  }
}

/**
 * Marks an order as paid, generates real ticket rows, and emails the buyer.
 * Safe to call more than once for the same order - if tickets already exist,
 * returns those codes instead of generating duplicates.
 *
 * Inventory (quantity_sold) is reserved atomically when the order is created
 * (see app/api/orders/route.ts). This function must NOT increment quantity_sold
 * again, or pending holds would be double-counted.
 */
export async function finalizePaidOrder(orderId: string, baseUrl: string): Promise<string[]> {
  const [order] = await sql`
    SELECT id, payment_status, ticket_type_id, quantity, buyer_name, buyer_email, buyer_phone, event_id, promo_code_id, total_amount_kes, discount_amount_kes, paystack_reference
    FROM orders WHERE id = ${orderId}
  `;

  if (!order) return [];

  // Already finalized with tickets - return existing codes (idempotent).
  const existing = await sql`SELECT ticket_code FROM tickets WHERE order_id = ${order.id}`;
  if (existing.length > 0) {
    return existing.map((t) => String(t.ticket_code));
  }

  // Atomically claim this order for finalizing before generating tickets,
  // sending the confirmation email/SMS, awarding loyalty points, or
  // incrementing promo usage. finalizePaidOrder is called from both the
  // Paystack webhook and the browser verify-redirect route for the same
  // payment, sometimes within milliseconds of each other. Without this
  // claim, both calls could pass the "no tickets yet" check above before
  // either has inserted anything, and both would generate a duplicate set
  // of real tickets. Postgres serializes concurrent updates to the same
  // row, so only one call ever wins this claim - the same pattern used to
  // fix the payout and refund race conditions.
  let claimed = false;
  if (order.payment_status === 'expired') {
    // Late payment: the expiry cron already released this order's seats.
    // Re-reserve them atomically, or refund the buyer if they're gone.
    const outcome = await reclaimExpiredOrder(order);
    if (outcome === 'refund') {
      await refundLatePayment(order);
      return [];
    }
    claimed = outcome === 'claimed';
  } else {
    const [row] = await sql`
      UPDATE orders SET payment_status = 'paid'
      WHERE id = ${order.id} AND payment_status != 'paid' AND payment_status != 'refunded'
      RETURNING id
    `;
    claimed = !!row;
  }

  if (!claimed) {
    // Another call already claimed (or already finished finalizing) this
    // order. Return whatever tickets exist right now rather than risking
    // a duplicate set - the winning call's tickets are what the buyer
    // actually gets emailed/texted.
    const nowExisting = await sql`SELECT ticket_code FROM tickets WHERE order_id = ${order.id}`;
    return nowExisting.map((t) => String(t.ticket_code));
  }

  if (order.promo_code_id) {
    // Atomic guard: only increments if still under the limit, so the
    // stored count can never overshoot max_uses even under concurrent
    // near-simultaneous redemptions. (Payment has already succeeded via
    // Paystack by this point, so a losing concurrent order still keeps
    // its discount - this guard protects future validation, not this
    // specific edge case, which is an acceptable tradeoff.)
    await sql`
      UPDATE promo_codes
      SET uses_count = uses_count + 1
      WHERE id = ${order.promo_code_id}
        AND (max_uses IS NULL OR uses_count < max_uses)
    `;
  }

  // Non-blocking: a loyalty-points failure should never stop ticket issuance.
  awardPointsForOrder(order.id, order.buyer_email, Number(order.total_amount_kes || 0));

  const generatedCodes: string[] = [];
  for (let i = 0; i < order.quantity; i++) {
    const ticketCode = nanoid(10).toUpperCase();
    await sql`
      INSERT INTO tickets (order_id, ticket_type_id, ticket_code, holder_name, holder_email, status)
      VALUES (${order.id}, ${order.ticket_type_id}, ${ticketCode}, ${order.buyer_name}, ${order.buyer_email}, 'valid')
    `;
    generatedCodes.push(ticketCode);
  }

  // quantity_sold is reserved atomically at order creation - do not increment here.

  const [eventDetails] = await sql`
    SELECT title, venue_name, start_at FROM events WHERE id = ${order.event_id}
  `;

  if (eventDetails) {
    try {
      await sendTicketEmail({
        toEmail: order.buyer_email,
        buyerName: order.buyer_name,
        eventTitle: eventDetails.title,
        venueName: eventDetails.venue_name,
        startAt: eventDetails.start_at,
        ticketCodes: generatedCodes,
        baseUrl,
      });
    } catch (emailErr) {
      console.error('Failed to send ticket email:', emailErr);
    }

    if (order.buyer_phone) {
      try {
        await sendTicketConfirmationSms({
          toPhone: order.buyer_phone,
          eventTitle: eventDetails.title,
          quantity: order.quantity,
          ticketCodes: generatedCodes,
        });
      } catch (smsErr) {
        console.error('Failed to send ticket confirmation SMS:', smsErr);
      }
    }
  }

  return generatedCodes;
}
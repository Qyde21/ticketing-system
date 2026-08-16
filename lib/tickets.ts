import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendTicketEmail } from '@/lib/email';
import { sendTicketConfirmationSms } from '@/lib/sms';

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
    SELECT id, payment_status, ticket_type_id, quantity, buyer_name, buyer_email, buyer_phone, event_id, promo_code_id
    FROM orders WHERE id = ${orderId}
  `;

  if (!order) return [];

  // Already finalized with tickets - return existing codes (idempotent).
  const existing = await sql`SELECT ticket_code FROM tickets WHERE order_id = ${order.id}`;
  if (existing.length > 0) {
    if (order.payment_status !== 'paid') {
      await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${order.id}`;
    }
    return existing.map((t) => String(t.ticket_code));
  }

  // Mark paid if still pending. Promo use is counted only on the first transition to paid.
  if (order.payment_status !== 'paid') {
    await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${order.id}`;

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
  }

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

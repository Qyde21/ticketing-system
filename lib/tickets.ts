import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendTicketEmail } from '@/lib/email';
import { sendTicketConfirmationSms } from '@/lib/sms';

/**
 * Marks an order as paid, generates real ticket rows, and emails the buyer.
 * Safe to call more than once for the same order — if tickets already exist,
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

  // Already finalized with tickets — return existing codes (idempotent).
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
      await sql`UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = ${order.promo_code_id}`;
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

  // quantity_sold is reserved atomically at order creation — do not increment here.

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


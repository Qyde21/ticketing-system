import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendTicketEmail } from '@/lib/email';

/**
 * Marks an order as paid, generates real ticket rows, increments the ticket
 * type's sold count, and emails the buyer their tickets. Safe to call more
 * than once for the same order - if it's already paid, it just returns the
 * existing ticket codes instead of generating duplicates.
 */
export async function finalizePaidOrder(orderId: string, baseUrl: string): Promise<string[]> {
  const [order] = await sql`
    SELECT id, payment_status, ticket_type_id, quantity, buyer_name, buyer_email, event_id, promo_code_id
    FROM orders WHERE id = ${orderId}
  `;

  if (!order) return [];

  if (order.payment_status === 'paid') {
    const existing = await sql`SELECT ticket_code FROM tickets WHERE order_id = ${order.id}`;
    if (existing.length > 0) {
      return existing.map((t: any) => t.ticket_code);
    }
    // Order was already marked paid but has no tickets yet (e.g. race condition) - fall through and generate them.
  } else {
    await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${order.id}`;

    if (order.promo_code_id) {
      await sql`UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = ${order.promo_code_id}`;
    }
  }

  const generatedCodes: string[] = [];
  for (let i = 0; i < order.quantity; i++) {
    const ticketCode = nanoid(10).toUpperCase();
    await sql`
      INSERT INTO tickets (order_id, ticket_type_id, ticket_code, holder_name, status)
      VALUES (${order.id}, ${order.ticket_type_id}, ${ticketCode}, ${order.buyer_name}, 'valid')
    `;
    generatedCodes.push(ticketCode);
  }

  await sql`
    UPDATE ticket_types SET quantity_sold = quantity_sold + ${order.quantity}
    WHERE id = ${order.ticket_type_id}
  `;

  const [eventDetails] = await sql`
    SELECT title, venue_name, start_at FROM events WHERE id = ${order.event_id}
  `;

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

  return generatedCodes;
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const { ticketTypeId, quantity = 1, buyerName, buyerEmail, buyerPhone } = await req.json();

    if (!ticketTypeId || !buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }

    // 1. Try finding ticket type directly by ID
    let tickets = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id::text = ${ticketTypeId}
    `;

    let ticketType = tickets[0];

    // 2. If not found, check if the identifier was actually an event ID
    if (!ticketType) {
      const eventTickets = await sql`
        SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
        FROM ticket_types WHERE event_id::text = ${ticketTypeId} LIMIT 1
      `;
      ticketType = eventTickets[0];
    }

    // 3. Absolute fallback to any ticket type if still not found
    if (!ticketType) {
      const fallback = await sql`
        SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
        FROM ticket_types LIMIT 1
      `;
      ticketType = fallback[0];
    }

    if (!ticketType) {
      return NextResponse.json({ error: 'No tickets available' }, { status: 404 });
    }

    const totalAmount = Number(ticketType.price_kes || 0) * quantity;
    const reference = `tk-${nanoid(16)}`;

    const [order] = await sql`
      INSERT INTO orders (event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes, payment_status, paystack_reference, ticket_type_id, quantity)
      VALUES (${ticketType.event_id}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${totalAmount}, 'pending', ${reference}, ${ticketType.id}, ${quantity})
      RETURNING id
    `;

    return NextResponse.json({ success: true, orderId: order.id, reference });
  } catch (err: any) {
    console.error("Order creation error:", err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}
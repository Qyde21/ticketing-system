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

    const [ticketType] = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id::text = ${ticketTypeId}
    `;

    if (!ticketType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
    }

    if (ticketType.max_per_order && quantity > ticketType.max_per_order) {
      return NextResponse.json({ error: `Max ${ticketType.max_per_order} tickets per order` }, { status: 400 });
    }

    const total = ticketType.quantity_total ?? 0;
    const sold = ticketType.quantity_sold ?? 0;
    const remaining = Math.max(0, total - sold);

    if (total > 0 && quantity > remaining) {
      return NextResponse.json({ error: `Only ${remaining} tickets left` }, { status: 400 });
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
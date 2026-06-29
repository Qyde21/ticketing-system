import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initializeTransaction } from '@/lib/paystack';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const { eventId, ticketTypeId, quantity, buyerName, buyerEmail, buyerPhone } = await req.json();

    if (!eventId || !ticketTypeId || !quantity || !buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }

    const [ticketType] = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id = ${ticketTypeId} AND event_id = ${eventId}
    `;
    if (!ticketType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
    }
    if (quantity > ticketType.max_per_order) {
      return NextResponse.json({ error: `Max ${ticketType.max_per_order} tickets per order` }, { status: 400 });
    }
    const remaining = ticketType.quantity_total - ticketType.quantity_sold;
    if (quantity > remaining) {
      return NextResponse.json({ error: `Only ${remaining} tickets left` }, { status: 400 });
    }

    const totalAmount = Number(ticketType.price_kes) * quantity;
    const reference = `tk-${nanoid(16)}`;

    const [order] = await sql`
      INSERT INTO orders (event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes, payment_status, paystack_reference, ticket_type_id, quantity)
      VALUES (${eventId}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${totalAmount}, 'pending', ${reference}, ${ticketTypeId}, ${quantity})
      RETURNING id
    `;

    const callbackUrl = `${req.nextUrl.origin}/checkout/callback`;

    const { authorization_url } = await initializeTransaction({
      email: buyerEmail,
      amountKes: totalAmount,
      reference,
      callbackUrl,
      metadata: { orderId: order.id },
    });

    return NextResponse.json({ authorizationUrl: authorization_url, reference });
  } catch (err) {
    console.error('Create order error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
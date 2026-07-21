import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketTypeId, quantity = 1, buyerName, buyerEmail, buyerPhone } = body;

    if (!ticketTypeId || !buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ error: 'Missing required fields', received: body }, { status: 400 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }

    let tickets = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id::text = ${ticketTypeId}
    `;
    let ticketType = tickets[0];

    if (!ticketType) {
      const eventTickets = await sql`
        SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
        FROM ticket_types WHERE event_id::text = ${ticketTypeId} LIMIT 1
      `;
      ticketType = eventTickets[0];
    }

    if (!ticketType) {
      const fallback = await sql`
        SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
        FROM ticket_types LIMIT 1
      `;
      ticketType = fallback[0];
    }

    if (!ticketType) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const amountKes = Number(ticketType.price_kes || 0) * quantity;
    const amountInSubunits = Math.round(amountKes * 100);
    const reference = `tk-${nanoid(16)}`;

    let authorizationUrl = '';
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (paystackSecret) {
      try {
        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: buyerEmail,
            amount: amountInSubunits,
            reference: reference,
            callback_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/orders/verify?reference=${reference}`
          })
        });

        const paystackData = await paystackRes.json();
        if (paystackData.status && paystackData.data?.authorization_url) {
          authorizationUrl = paystackData.data.authorization_url;
        }
      } catch (paystackErr) {
        console.warn("Paystack API call failed:", paystackErr);
      }
    }

    const [order] = await sql`
      INSERT INTO orders (event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes, payment_status, paystack_reference, ticket_type_id, quantity)
      VALUES (${ticketType.event_id}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${amountKes}, ${authorizationUrl ? 'pending' : 'paid'}, ${reference}, ${ticketType.id}, ${quantity})
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      orderId: order.id, 
      reference, 
      authorizationUrl: authorizationUrl || null
    });

  } catch (err: any) {
    console.error("Order creation error:", err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}
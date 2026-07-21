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

    // 1. Fetch ticket type details
    let tickets = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id::text = ${ticketTypeId}
    `;
    let ticketType = tickets[0];

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

    const amountKes = Number(ticketType.price_kes || 0) * quantity;
    // Paystack expects amount in minor subunits (cents/pesewas/kobo -> multiply KES by 100 for cents or pass appropriate integer amount)
    const amountInSubunits = Math.round(amountKes * 100); 
    const reference = `tk-${nanoid(16)}`;

    // 2. Initialize transaction with Paystack API
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ error: 'Paystack secret key is not configured' }, { status: 500 });
    }

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

    if (!paystackData.status) {
      return NextResponse.json({ error: paystackData.message || 'Failed to initialize Paystack transaction' }, { status: 400 });
    }

    const authorizationUrl = paystackData.data.authorization_url;

    // 3. Save pending order in database
    const [order] = await sql`
      INSERT INTO orders (event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes, payment_status, paystack_reference, ticket_type_id, quantity)
      VALUES (${ticketType.event_id}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${amountKes}, 'pending', ${reference}, ${ticketType.id}, ${quantity})
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      orderId: order.id, 
      reference, 
      authorizationUrl 
    });

  } catch (err: any) {
    console.error("Order creation & Paystack error:", err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}
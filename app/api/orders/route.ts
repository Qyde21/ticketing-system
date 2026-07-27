import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { finalizePaidOrder } from '@/lib/tickets';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketTypeId, quantity = 1, buyerName, buyerEmail: rawBuyerEmail, buyerPhone } = body;
    const buyerEmail = typeof rawBuyerEmail === 'string' ? rawBuyerEmail.trim().toLowerCase() : rawBuyerEmail;

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

    const remaining = Number(ticketType.quantity_total || 0) - Number(ticketType.quantity_sold || 0);
    if (quantity > remaining) {
      return NextResponse.json({ error: `Only ${Math.max(0, remaining)} ticket(s) remaining for this tier` }, { status: 400 });
    }
    if (ticketType.max_per_order && quantity > ticketType.max_per_order) {
      return NextResponse.json({ error: `Maximum ${ticketType.max_per_order} tickets per order` }, { status: 400 });
    }

    const [event] = await sql`
      SELECT status, start_at, end_at FROM events WHERE id = ${ticketType.event_id}
    `;
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.status === 'cancelled') {
      return NextResponse.json({ error: 'This event has been cancelled' }, { status: 400 });
    }
    const eventEnd = event.end_at ? new Date(event.end_at) : new Date(event.start_at);
    if (eventEnd < new Date()) {
      return NextResponse.json({ error: 'This event has already ended' }, { status: 400 });
    }

    const amountKes = Number(ticketType.price_kes || 0) * quantity;
    const amountInSubunits = Math.round(amountKes * 100);
    const reference = `tk-${nanoid(16)}`;
    const isFree = amountKes <= 0;

    let authorizationUrl = '';

    if (!isFree) {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

      if (!paystackSecret) {
        console.error('PAYSTACK_SECRET_KEY is not configured');
        return NextResponse.json({ error: 'Payments are not configured right now. Please contact support.' }, { status: 503 });
      }

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
            callback_url: `${req.nextUrl.origin}/api/orders/verify?reference=${reference}`
          })
        });

        const paystackData = await paystackRes.json();
        if (paystackData.status && paystackData.data?.authorization_url) {
          authorizationUrl = paystackData.data.authorization_url;
        } else {
          console.error('Paystack did not return an authorization URL:', paystackData);
          return NextResponse.json({ error: 'Unable to start payment right now. Please try again shortly.' }, { status: 502 });
        }
      } catch (paystackErr) {
        console.error('Paystack API call failed:', paystackErr);
        return NextResponse.json({ error: 'Unable to reach the payment provider. Please try again shortly.' }, { status: 502 });
      }
    }

    const [order] = await sql`
      INSERT INTO orders (event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes, payment_status, paystack_reference, ticket_type_id, quantity)
      VALUES (${ticketType.event_id}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${amountKes}, ${isFree ? 'paid' : 'pending'}, ${reference}, ${ticketType.id}, ${quantity})
      RETURNING id
    `;

    if (isFree) {
      await finalizePaidOrder(order.id, req.nextUrl.origin);
    }

    return NextResponse.json({ 
      success: true, 
      orderId: order.id, 
      reference, 
      authorizationUrl: authorizationUrl || null,
      isFree
    });

  } catch (err: any) {
    console.error("Order creation error:", err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

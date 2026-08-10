import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { finalizePaidOrder } from '@/lib/tickets';
import { validatePromoCode } from '@/lib/promoCodes';

export async function POST(req: NextRequest) {
  // Hoisted so the outer catch can release a reservation if something
  // unexpected fails after inventory was reserved but before the order
  // was successfully inserted.
  let reservedTicketTypeId: string | null = null;
  let reservedQuantity = 0;
  let reservedFlashApplied = false;

  try {
    const body = await req.json();
    const { ticketTypeId, quantity = 1, buyerName, buyerEmail: rawBuyerEmail, buyerPhone, promoCode } = body;
    const buyerEmail = typeof rawBuyerEmail === 'string' ? rawBuyerEmail.trim().toLowerCase() : rawBuyerEmail;

    if (!ticketTypeId || !buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ error: 'Missing required fields', received: body }, { status: 400 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }

    const basicTickets = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id::text = ${ticketTypeId}
    `;
    const basicTicketType = basicTickets[0];

    if (!basicTicketType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
    }
    if (basicTicketType.max_per_order && quantity > basicTicketType.max_per_order) {
      return NextResponse.json({ error: `Maximum ${basicTicketType.max_per_order} tickets per order` }, { status: 400 });
    }

    // Atomically reserve inventory: only succeeds if enough remains, and can't
    // be beaten by a simultaneous purchase (locked via FOR UPDATE within the
    // same statement, unlike a separate SELECT-then-check).
    // Also determines, in the same atomic step, whether this purchase
    // qualifies for an active flash sale price (time window + quantity cap
    // both still available for the full requested quantity) â€” if the whole
    // quantity doesn't fit under a remaining flash cap, it's sold at the
    // regular price instead of being split into two prices.
    const reserved = await sql`
      WITH current AS (
        SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order,
               flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
               flash_sale_quantity_cap, flash_sale_quantity_sold
        FROM ticket_types
        WHERE id::text = ${ticketTypeId}
        FOR UPDATE
      ),
      eligible AS (
        SELECT *,
          (flash_sale_price_kes IS NOT NULL
            AND now() BETWEEN flash_sale_starts_at AND flash_sale_ends_at
            AND (flash_sale_quantity_cap IS NULL OR flash_sale_quantity_sold + ${quantity} <= flash_sale_quantity_cap)
          ) AS flash_applies
        FROM current
      )
      UPDATE ticket_types t
      SET quantity_sold = t.quantity_sold + ${quantity},
          flash_sale_quantity_sold = t.flash_sale_quantity_sold + (CASE WHEN eligible.flash_applies THEN ${quantity} ELSE 0 END)
      FROM eligible
      WHERE t.id = eligible.id
        AND eligible.quantity_sold + ${quantity} <= eligible.quantity_total
      RETURNING t.id, t.event_id, t.price_kes, t.quantity_total, t.quantity_sold, t.max_per_order,
                eligible.flash_applies, eligible.flash_sale_price_kes
    `;
    const ticketType = reserved[0];

    if (!ticketType) {
      const remaining = Number(basicTicketType.quantity_total || 0) - Number(basicTicketType.quantity_sold || 0);
      return NextResponse.json({ error: `Only ${Math.max(0, remaining)} ticket(s) remaining for this tier` }, { status: 400 });
    }

    // From this point on, inventory is reserved. Any early return below must
    // release it first, or the seats will be locked without a completed order.
    reservedTicketTypeId = ticketType.id;
    reservedQuantity = quantity;
    reservedFlashApplied = !!ticketType.flash_applies;
    const releaseReservation = () => sql`
      UPDATE ticket_types
      SET quantity_sold = GREATEST(0, quantity_sold - ${quantity}),
          flash_sale_quantity_sold = GREATEST(0, flash_sale_quantity_sold - ${ticketType.flash_applies ? quantity : 0})
      WHERE id = ${ticketType.id}
    `;

    const [event] = await sql`
      SELECT e.status, e.start_at, e.end_at, e.organizer_id, u.status AS organizer_status
      FROM events e
      JOIN users u ON u.id = e.organizer_id
      WHERE e.id = ${ticketType.event_id}
    `;
    if (!event) {
      await releaseReservation();
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.organizer_status === 'suspended') {
      await releaseReservation();
      return NextResponse.json({ error: 'This event is not currently available for ticket sales' }, { status: 400 });
    }
    if (event.status === 'cancelled') {
      await releaseReservation();
      return NextResponse.json({ error: 'This event has been cancelled' }, { status: 400 });
    }
    if (event.status !== 'published') {
      await releaseReservation();
      return NextResponse.json({ error: 'This event is not currently available for ticket sales' }, { status: 400 });
    }
    const eventEnd = event.end_at ? new Date(event.end_at) : new Date(event.start_at);
    if (eventEnd < new Date()) {
      await releaseReservation();
      return NextResponse.json({ error: 'This event has already ended' }, { status: 400 });
    }

    const effectivePriceKes = ticketType.flash_applies
      ? Number(ticketType.flash_sale_price_kes)
      : Number(ticketType.price_kes || 0);
    const subtotalKes = effectivePriceKes * quantity;

    let amountKes = subtotalKes;
    let promoCodeId: string | null = null;
    let discountAmountKes = 0;

    if (promoCode && String(promoCode).trim()) {
      const promoResult = await validatePromoCode(ticketType.event_id, promoCode, subtotalKes);
      if (!promoResult.valid) {
        await releaseReservation();
        return NextResponse.json({ error: promoResult.error || 'Invalid promo code' }, { status: 400 });
      }
      promoCodeId = promoResult.promoCodeId!;
      discountAmountKes = promoResult.discountAmount!;
      amountKes = promoResult.finalAmount!;
    }

    const amountInSubunits = Math.round(amountKes * 100);
    const reference = `tk-${nanoid(16)}`;
    const isFree = amountKes <= 0;

    let authorizationUrl = '';

    if (!isFree) {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

      if (!paystackSecret) {
        console.error('PAYSTACK_SECRET_KEY is not configured');
        await releaseReservation();
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
          await releaseReservation();
          return NextResponse.json({ error: 'Unable to start payment right now. Please try again shortly.' }, { status: 502 });
        }
      } catch (paystackErr) {
        console.error('Paystack API call failed:', paystackErr);
        await releaseReservation();
        return NextResponse.json({ error: 'Unable to reach the payment provider. Please try again shortly.' }, { status: 502 });
      }
    }

    const [order] = await sql`
      INSERT INTO orders (event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes, promo_code_id, discount_amount_kes, payment_status, paystack_reference, ticket_type_id, quantity)
      VALUES (${ticketType.event_id}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${amountKes}, ${promoCodeId}, ${discountAmountKes}, ${isFree ? 'paid' : 'pending'}, ${reference}, ${ticketType.id}, ${quantity})
      RETURNING id
    `;

    // Order row exists now, so the reservation is accounted for â€” no
    // release needed even if something below this point throws.
    reservedTicketTypeId = null;

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
    if (reservedTicketTypeId) {
      try {
        await sql`
          UPDATE ticket_types
          SET quantity_sold = GREATEST(0, quantity_sold - ${reservedQuantity}),
              flash_sale_quantity_sold = GREATEST(0, flash_sale_quantity_sold - ${reservedFlashApplied ? reservedQuantity : 0})
          WHERE id = ${reservedTicketTypeId}
        `;
      } catch (releaseErr) {
        console.error('Failed to release ticket reservation after error:', releaseErr);
      }
    }
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

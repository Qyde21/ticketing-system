import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { finalizePaidOrder } from '@/lib/tickets';
import { validatePromoCode } from '@/lib/promoCodes';

/**
 * Create an order and (for paid tickets) start Paystack checkout.
 *
 * Inventory is reserved atomically here by incrementing quantity_sold only when
 * capacity remains. That hold is released on refund. finalizePaidOrder does not
 * increment sold again.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketTypeId, quantity = 1, buyerName, buyerEmail: rawBuyerEmail, buyerPhone, promoCode } = body;
    const buyerEmail = typeof rawBuyerEmail === 'string' ? rawBuyerEmail.trim().toLowerCase() : rawBuyerEmail;

    if (!ticketTypeId || !buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }
    const qty = Number(quantity);

    // Exact ticket type only — no event-id or "any tier" fallbacks (those could sell the wrong event).
    const tickets = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id::text = ${String(ticketTypeId)}
    `;
    const ticketType = tickets[0];

    if (!ticketType) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticketType.max_per_order && qty > ticketType.max_per_order) {
      return NextResponse.json(
        { error: `Maximum ${ticketType.max_per_order} tickets per order` },
        { status: 400 }
      );
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
    if (event.status !== 'published') {
      return NextResponse.json(
        { error: 'This event is not currently available for ticket sales' },
        { status: 400 }
      );
    }
    const eventEnd = event.end_at ? new Date(event.end_at) : new Date(event.start_at);
    if (eventEnd < new Date()) {
      return NextResponse.json({ error: 'This event has already ended' }, { status: 400 });
    }

    const subtotalKes = Number(ticketType.price_kes || 0) * qty;

    let amountKes = subtotalKes;
    let promoCodeId: string | null = null;
    let discountAmountKes = 0;

    if (promoCode && String(promoCode).trim()) {
      const promoResult = await validatePromoCode(ticketType.event_id, promoCode, subtotalKes);
      if (!promoResult.valid) {
        return NextResponse.json({ error: promoResult.error || 'Invalid promo code' }, { status: 400 });
      }
      promoCodeId = promoResult.promoCodeId!;
      discountAmountKes = promoResult.discountAmount!;
      amountKes = promoResult.finalAmount!;
    }

    // Atomic capacity reservation — prevents overselling under concurrent checkout.
    const reserved = await sql`
      UPDATE ticket_types
      SET quantity_sold = quantity_sold + ${qty}
      WHERE id = ${ticketType.id}
        AND quantity_sold + ${qty} <= quantity_total
      RETURNING id, quantity_sold, quantity_total
    `;

    if (reserved.length === 0) {
      const remaining = Math.max(
        0,
        Number(ticketType.quantity_total || 0) - Number(ticketType.quantity_sold || 0)
      );
      return NextResponse.json(
        { error: remaining > 0 ? `Only ${remaining} ticket(s) remaining for this tier` : 'Sold out' },
        { status: 400 }
      );
    }

    const amountInSubunits = Math.round(amountKes * 100);
    const reference = `tk-${nanoid(16)}`;
    const isFree = amountKes <= 0;

    let authorizationUrl = '';

    if (!isFree) {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

      if (!paystackSecret) {
        // Release the hold we just took.
        await sql`
          UPDATE ticket_types
          SET quantity_sold = GREATEST(0, quantity_sold - ${qty})
          WHERE id = ${ticketType.id}
        `;
        console.error('PAYSTACK_SECRET_KEY is not configured');
        return NextResponse.json(
          { error: 'Payments are not configured right now. Please contact support.' },
          { status: 503 }
        );
      }

      try {
        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: buyerEmail,
            amount: amountInSubunits,
            reference: reference,
            callback_url: `${req.nextUrl.origin}/api/orders/verify?reference=${reference}`,
          }),
        });

        const paystackData = await paystackRes.json();
        if (paystackData.status && paystackData.data?.authorization_url) {
          authorizationUrl = paystackData.data.authorization_url;
        } else {
          await sql`
            UPDATE ticket_types
            SET quantity_sold = GREATEST(0, quantity_sold - ${qty})
            WHERE id = ${ticketType.id}
          `;
          console.error('Paystack did not return an authorization URL:', paystackData);
          return NextResponse.json(
            { error: 'Unable to start payment right now. Please try again shortly.' },
            { status: 502 }
          );
        }
      } catch (paystackErr) {
        await sql`
          UPDATE ticket_types
          SET quantity_sold = GREATEST(0, quantity_sold - ${qty})
          WHERE id = ${ticketType.id}
        `;
        console.error('Paystack API call failed:', paystackErr);
        return NextResponse.json(
          { error: 'Unable to reach the payment provider. Please try again shortly.' },
          { status: 502 }
        );
      }
    }

    let order: { id: string };
    try {
      const inserted = await sql`
        INSERT INTO orders (
          event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes,
          promo_code_id, discount_amount_kes, payment_status, paystack_reference,
          ticket_type_id, quantity
        )
        VALUES (
          ${ticketType.event_id}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${amountKes},
          ${promoCodeId}, ${discountAmountKes}, 'pending', ${reference},
          ${ticketType.id}, ${qty}
        )
        RETURNING id
      `;
      order = inserted[0] as { id: string };
    } catch (insertErr) {
      // Compensate reservation if order row could not be created.
      await sql`
        UPDATE ticket_types
        SET quantity_sold = GREATEST(0, quantity_sold - ${qty})
        WHERE id = ${ticketType.id}
      `;
      throw insertErr;
    }

    if (isFree) {
      await finalizePaidOrder(order.id, req.nextUrl.origin);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      reference,
      authorizationUrl: authorizationUrl || null,
      isFree,
    });
  } catch (err: unknown) {
    console.error('Order creation error:', err);
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

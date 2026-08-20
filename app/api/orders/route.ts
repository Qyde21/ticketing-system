import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { finalizePaidOrder } from '@/lib/tickets';
import { validatePromoCode } from '@/lib/promoCodes';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';

type CartItem = { ticketTypeId: string; quantity: number };

type Reservation = {
  ticketTypeId: string;
  quantity: number;
  flashApplied: boolean;
  eventId: string;
  unitPrice: number;
  lineTotal: number;
};

async function reserveTier(ticketTypeId: string, quantity: number): Promise<
  | { ok: true; reservation: Reservation }
  | { ok: false; error: string; status: number }
> {
  if (quantity < 1) {
    return { ok: false, error: 'Quantity must be at least 1', status: 400 };
  }

  const basicTickets = await sql`
    SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
    FROM ticket_types WHERE id::text = ${ticketTypeId}
  `;
  const basicTicketType = basicTickets[0];
  if (!basicTicketType) {
    return { ok: false, error: 'Ticket type not found', status: 404 };
  }
  if (basicTicketType.max_per_order && quantity > basicTicketType.max_per_order) {
    return {
      ok: false,
      error: `Maximum ${basicTicketType.max_per_order} tickets per order for this tier`,
      status: 400,
    };
  }

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
    RETURNING t.id, t.event_id, t.price_kes, eligible.flash_applies, eligible.flash_sale_price_kes
  `;
  const ticketType = reserved[0];
  if (!ticketType) {
    const remaining = Number(basicTicketType.quantity_total || 0) - Number(basicTicketType.quantity_sold || 0);
    return {
      ok: false,
      error: `Only ${Math.max(0, remaining)} ticket(s) remaining for one of the selected tiers`,
      status: 400,
    };
  }

  const unitPrice = ticketType.flash_applies
    ? Number(ticketType.flash_sale_price_kes)
    : Number(ticketType.price_kes || 0);

  return {
    ok: true,
    reservation: {
      ticketTypeId: ticketType.id,
      quantity,
      flashApplied: !!ticketType.flash_applies,
      eventId: ticketType.event_id,
      unitPrice,
      lineTotal: unitPrice * quantity,
    },
  };
}

async function releaseReservation(r: Reservation) {
  await sql`
    UPDATE ticket_types
    SET quantity_sold = GREATEST(0, quantity_sold - ${r.quantity}),
        flash_sale_quantity_sold = GREATEST(0, flash_sale_quantity_sold - ${r.flashApplied ? r.quantity : 0})
    WHERE id = ${r.ticketTypeId}
  `;
}

export async function POST(req: NextRequest) {
  const reservations: Reservation[] = [];

  try {
    const body = await req.json();
    const { buyerName, buyerEmail: rawBuyerEmail, buyerPhone, promoCode } = body;
    const buyerEmail = typeof rawBuyerEmail === 'string' ? rawBuyerEmail.trim().toLowerCase() : rawBuyerEmail;

    if (!buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ error: 'Missing required fields', received: body }, { status: 400 });
    }

    // Rate limit by buyer email and IP before any reservation work begins —
    // this protects ticket inventory from being locked up by repeated
    // automated checkout attempts, the same protection already applied to
    // login, signup, and forgot-password.
    const ip = getClientIp(req);
    const rateLimitOk = await checkRateLimit({
      type: 'checkout',
      email: String(buyerEmail),
      ip,
      maxAttempts: 8,
      windowMinutes: 15,
    });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }
    await recordAttempt('checkout', String(buyerEmail), ip);

    let items: CartItem[] = [];
    if (Array.isArray(body.items) && body.items.length > 0) {
      items = body.items.map((it: any) => ({
        ticketTypeId: String(it.ticketTypeId),
        quantity: Number(it.quantity) || 0,
      }));
    } else if (body.ticketTypeId) {
      items = [{ ticketTypeId: String(body.ticketTypeId), quantity: Number(body.quantity) || 1 }];
    } else {
      return NextResponse.json({ error: 'Missing ticket selection' }, { status: 400 });
    }

    const merged = new Map<string, number>();
    for (const it of items) {
      if (!it.ticketTypeId || it.quantity < 1) continue;
      merged.set(it.ticketTypeId, (merged.get(it.ticketTypeId) || 0) + it.quantity);
    }
    items = Array.from(merged.entries()).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid ticket quantities' }, { status: 400 });
    }

    for (const it of items) {
      const result = await reserveTier(it.ticketTypeId, it.quantity);
      if (!result.ok) {
        for (const r of reservations) {
          try { await releaseReservation(r); } catch {}
        }
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      reservations.push(result.reservation);
    }

    const eventId = reservations[0].eventId;
    if (reservations.some((r) => r.eventId !== eventId)) {
      for (const r of reservations) {
        try { await releaseReservation(r); } catch {}
      }
      return NextResponse.json({ error: 'All tickets must be for the same event' }, { status: 400 });
    }

    const [event] = await sql`
      SELECT e.status, e.start_at, e.end_at, e.organizer_id, u.status AS organizer_status
      FROM events e
      JOIN users u ON u.id = e.organizer_id
      WHERE e.id = ${eventId}
    `;
    if (!event) {
      for (const r of reservations) await releaseReservation(r);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.organizer_status === 'suspended' || event.status !== 'published') {
      for (const r of reservations) await releaseReservation(r);
      return NextResponse.json({ error: 'This event is not currently available for ticket sales' }, { status: 400 });
    }
    if (event.status === 'cancelled') {
      for (const r of reservations) await releaseReservation(r);
      return NextResponse.json({ error: 'This event has been cancelled' }, { status: 400 });
    }
    const eventEnd = event.end_at ? new Date(event.end_at) : new Date(event.start_at);
    if (eventEnd < new Date()) {
      for (const r of reservations) await releaseReservation(r);
      return NextResponse.json({ error: 'This event has already ended' }, { status: 400 });
    }

    const subtotalKes = reservations.reduce((s, r) => s + r.lineTotal, 0);
    let promoCodeId: string | null = null;
    let discountAmountKes = 0;
    let amountKes = subtotalKes;

    if (promoCode && String(promoCode).trim()) {
      const promoResult = await validatePromoCode(eventId, promoCode, subtotalKes);
      if (!promoResult.valid) {
        for (const r of reservations) await releaseReservation(r);
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
        for (const r of reservations) await releaseReservation(r);
        return NextResponse.json({ error: 'Payments are not configured right now. Please contact support.' }, { status: 503 });
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
            reference,
            callback_url: `${req.nextUrl.origin}/api/orders/verify?reference=${reference}`,
          }),
        });
        const paystackData = await paystackRes.json();
        if (paystackData.status && paystackData.data?.authorization_url) {
          authorizationUrl = paystackData.data.authorization_url;
        } else {
          for (const r of reservations) await releaseReservation(r);
          return NextResponse.json({ error: 'Unable to start payment right now. Please try again shortly.' }, { status: 502 });
        }
      } catch {
        for (const r of reservations) await releaseReservation(r);
        return NextResponse.json({ error: 'Unable to reach the payment provider. Please try again shortly.' }, { status: 502 });
      }
    }

    let remainingDiscount = discountAmountKes;
    const orderIds: string[] = [];

    for (let i = 0; i < reservations.length; i++) {
      const r = reservations[i];
      let lineAmount = r.lineTotal;
      let lineDiscount = 0;
      if (remainingDiscount > 0) {
        lineDiscount = Math.min(remainingDiscount, lineAmount);
        lineAmount = lineAmount - lineDiscount;
        remainingDiscount -= lineDiscount;
      }

      const [order] = await sql`
        INSERT INTO orders (
          event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes,
          promo_code_id, discount_amount_kes, payment_status, paystack_reference,
          ticket_type_id, quantity, is_flash_sale
        )
        VALUES (
          ${eventId}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${lineAmount},
          ${i === 0 ? promoCodeId : null}, ${lineDiscount},
          ${isFree ? 'paid' : 'pending'}, ${reference},
          ${r.ticketTypeId}, ${r.quantity}, ${r.flashApplied}
        )
        RETURNING id
      `;
      orderIds.push(order.id);
    }

    reservations.length = 0;

    if (isFree) {
      for (const id of orderIds) {
        await finalizePaidOrder(id, req.nextUrl.origin);
      }
    }

    return NextResponse.json({
      success: true,
      orderIds,
      orderId: orderIds[0],
      reference,
      authorizationUrl: authorizationUrl || null,
      isFree,
    });
  } catch (err: any) {
    console.error('Order creation error:', err);
    for (const r of reservations) {
      try {
        await releaseReservation(r);
      } catch (releaseErr) {
        console.error('Failed to release reservation:', releaseErr);
      }
    }
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}
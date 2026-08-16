import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eventId = req.nextUrl.searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  const [event] = await sql`SELECT organizer_id FROM events WHERE id = ${eventId}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
  }

  const codes = await sql`
    SELECT id, code, discount_type, discount_value, max_uses, uses_count, expires_at, active, created_at
    FROM promo_codes
    WHERE event_id = ${eventId}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { eventId, code, discountType, discountValue, maxUses, expiresAt } = await req.json();

    if (!eventId || !code || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (discountType !== 'percent' && discountType !== 'fixed') {
      return NextResponse.json({ error: 'discountType must be percent or fixed' }, { status: 400 });
    }
    const numericDiscount = Number(discountValue);
    if (!Number.isFinite(numericDiscount) || numericDiscount <= 0) {
      return NextResponse.json({ error: 'Discount value must be a positive number' }, { status: 400 });
    }
    if (discountType === 'percent' && numericDiscount > 100) {
      return NextResponse.json({ error: 'Percent discount cannot exceed 100' }, { status: 400 });
    }

    const [event] = await sql`SELECT organizer_id FROM events WHERE id = ${eventId}`;
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.organizer_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    if (!normalizedCode) {
      return NextResponse.json({ error: 'Code cannot be empty' }, { status: 400 });
    }

    const maxUsesValue = maxUses ? Number(maxUses) : null;
    const expiresAtValue = expiresAt ? new Date(expiresAt).toISOString() : null;

    try {
      const [promo] = await sql`
        INSERT INTO promo_codes (event_id, code, discount_type, discount_value, max_uses, expires_at)
        VALUES (${eventId}, ${normalizedCode}, ${discountType}, ${numericDiscount}, ${maxUsesValue}, ${expiresAtValue})
        RETURNING id, code, discount_type, discount_value, max_uses, uses_count, expires_at, active, created_at
      `;
      return NextResponse.json({ code: promo }, { status: 201 });
    } catch (dbErr: any) {
      if (dbErr.message && dbErr.message.includes('duplicate key')) {
        return NextResponse.json({ error: 'A code with this name already exists for this event' }, { status: 409 });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('Promo code creation error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

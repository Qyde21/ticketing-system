import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { validatePromoCode } from '@/lib/promoCodes';

export async function POST(req: NextRequest) {
  try {
    const { eventId, ticketTypeId, quantity, code } = await req.json();

    if (!eventId || !ticketTypeId || !code) {
      return NextResponse.json({ valid: false, error: 'Missing required fields' }, { status: 400 });
    }

    const qty = Math.max(1, Number(quantity) || 1);

    const [ticketType] = await sql`
      SELECT price_kes FROM ticket_types WHERE id = ${ticketTypeId} AND event_id = ${eventId}
    `;

    if (!ticketType) {
      return NextResponse.json({ valid: false, error: 'Ticket type not found' }, { status: 404 });
    }

    const subtotalKes = Number(ticketType.price_kes) * qty;

    const result = await validatePromoCode(eventId, code, subtotalKes);

    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch (err) {
    console.error('Promo code validation error:', err);
    return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 });
  }
}

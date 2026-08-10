import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function getOwnedTicketType(ticketTypeId: string, userId: string, role: string) {
  const rows = await sql`
    SELECT t.id, t.event_id, t.name, t.price_kes, e.organizer_id
    FROM ticket_types t
    JOIN events e ON e.id = t.event_id
    WHERE t.id = ${ticketTypeId}
  `;
  const row = rows[0];
  if (!row) return { error: 'Ticket type not found', status: 404 } as const;
  if (row.organizer_id !== userId && role !== 'admin') {
    return { error: 'Not authorized for this ticket type', status: 403 } as const;
  }
  return { row };
}

// Set (or update) a flash sale on a ticket tier.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { flashPriceKes, startsAt, endsAt, quantityCap } = await req.json();

    if (flashPriceKes === undefined || !startsAt || !endsAt) {
      return NextResponse.json({ error: 'flashPriceKes, startsAt and endsAt are required' }, { status: 400 });
    }

    const check = await getOwnedTicketType(id, session.userId, session.role);
    if ('error' in check) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const numericPrice = Number(flashPriceKes);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'flashPriceKes must be a non-negative number' }, { status: 400 });
    }
    if (numericPrice >= Number(check.row.price_kes)) {
      return NextResponse.json({ error: 'Flash sale price must be lower than the regular price' }, { status: 400 });
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
    }

    const cap = quantityCap === undefined || quantityCap === null || quantityCap === ''
      ? null
      : Number(quantityCap);
    if (cap !== null && (!Number.isInteger(cap) || cap < 1)) {
      return NextResponse.json({ error: 'quantityCap must be a positive whole number' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE ticket_types
      SET flash_sale_price_kes = ${numericPrice},
          flash_sale_starts_at = ${start.toISOString()},
          flash_sale_ends_at = ${end.toISOString()},
          flash_sale_quantity_cap = ${cap},
          flash_sale_quantity_sold = 0
      WHERE id = ${id}
      RETURNING id, name, flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at, flash_sale_quantity_cap, flash_sale_quantity_sold
    `;

    return NextResponse.json({ success: true, ticketType: updated });
  } catch (err: any) {
    console.error('Flash sale creation error:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

// Cancel an active flash sale on a ticket tier.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const check = await getOwnedTicketType(id, session.userId, session.role);
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  await sql`
    UPDATE ticket_types
    SET flash_sale_price_kes = NULL,
        flash_sale_starts_at = NULL,
        flash_sale_ends_at = NULL,
        flash_sale_quantity_cap = NULL,
        flash_sale_quantity_sold = 0
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true });
}

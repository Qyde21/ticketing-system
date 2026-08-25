import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const [event] = await sql`
    SELECT id, title, description, category, venue_name, venue_address,
           start_at, end_at, cover_image_url, organizer_id, status
    FROM events WHERE id = ${id}
  `;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const isOwner = session.userId === event.organizer_id;
  const isAdmin = session.role === 'admin';
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold, max_per_order
    FROM ticket_types WHERE event_id = ${id} ORDER BY created_at ASC
  `;

  return NextResponse.json({ event, ticketTypes });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const [event] = await sql`SELECT id, organizer_id FROM events WHERE id = ${id}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const isOwner = session.userId === event.organizer_id;
  const isAdmin = session.role === 'admin';
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { title, description, category, venueName, venueAddress, startAt, endAt, coverImageUrl, ticketTypes } = body;

  if (!title || !venueName || !startAt || !Array.isArray(ticketTypes) || ticketTypes.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (endAt && new Date(endAt) <= new Date(startAt)) {
    return NextResponse.json({ error: 'End date must be after the start date' }, { status: 400 });
  }
  for (const tt of ticketTypes) {
    if (!tt.name || typeof tt.name !== 'string' || !tt.name.trim()) {
      return NextResponse.json({ error: 'Every ticket type needs a name' }, { status: 400 });
    }
    if (typeof tt.priceKes !== 'number' || Number.isNaN(tt.priceKes) || tt.priceKes < 0) {
      return NextResponse.json({ error: `Invalid price for ticket type "${tt.name}"` }, { status: 400 });
    }
    if (!Number.isInteger(tt.quantityTotal) || tt.quantityTotal < 1) {
      return NextResponse.json({ error: `Quantity for "${tt.name}" must be at least 1` }, { status: 400 });
    }
  }

  // Reconcile ticket types against what already exists, without touching
  // sold inventory: a tier can't be shrunk below what's already sold, and
  // can't be removed at all once it has sales (removing it would orphan
  // every order that references it).
  const existing = await sql`
    SELECT id, quantity_sold FROM ticket_types WHERE event_id = ${id}
  `;
  const existingById = new Map(existing.map((row: any) => [row.id, row]));
  const submittedIds = new Set(ticketTypes.filter((tt: any) => tt.id).map((tt: any) => tt.id));

  for (const tt of ticketTypes) {
    if (tt.id) {
      const row = existingById.get(tt.id);
      if (!row) {
        return NextResponse.json({ error: `Ticket type "${tt.name}" does not belong to this event` }, { status: 400 });
      }
      if (tt.quantityTotal < Number(row.quantity_sold)) {
        return NextResponse.json(
          { error: `Quantity for "${tt.name}" can't be less than the ${row.quantity_sold} already sold` },
          { status: 400 }
        );
      }
    }
  }

  const toRemove = existing.filter((row: any) => !submittedIds.has(row.id));
  for (const row of toRemove) {
    if (Number(row.quantity_sold) > 0) {
      return NextResponse.json(
        { error: 'Cannot remove a ticket type that already has sales — keep it and set its quantity instead' },
        { status: 400 }
      );
    }
  }

  try {
    await sql`
      UPDATE events SET
        title = ${title},
        description = ${description ?? null},
        category = ${category ?? null},
        venue_name = ${venueName},
        venue_address = ${venueAddress ?? null},
        start_at = ${startAt},
        end_at = ${endAt ?? null},
        cover_image_url = ${coverImageUrl ?? null},
        updated_at = now()
      WHERE id = ${id}
    `;

    for (const tt of ticketTypes) {
      if (tt.id) {
        await sql`
          UPDATE ticket_types SET
            name = ${tt.name}, price_kes = ${tt.priceKes},
            quantity_total = ${tt.quantityTotal}, max_per_order = ${tt.maxPerOrder ?? 10}
          WHERE id = ${tt.id}
        `;
      } else {
        await sql`
          INSERT INTO ticket_types (event_id, name, price_kes, quantity_total, max_per_order)
          VALUES (${id}, ${tt.name}, ${tt.priceKes}, ${tt.quantityTotal}, ${tt.maxPerOrder ?? 10})
        `;
      }
    }

    for (const row of toRemove) {
      await sql`DELETE FROM ticket_types WHERE id = ${row.id}`;
    }

    if (isAdmin && session.userId !== event.organizer_id) {
      await writeAuditLog({
        actorId: session.userId,
        action: 'event.edit',
        entityType: 'event',
        entityId: id,
        meta: { title },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update event error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

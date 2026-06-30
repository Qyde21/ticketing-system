import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { slugify } from '@/lib/slugify';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, description, category, venueName, venueAddress, startAt, endAt, coverImageUrl, ticketTypes } = body;

    if (!title || !venueName || !startAt || !Array.isArray(ticketTypes) || ticketTypes.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let slug = slugify(title);
    const existing = await sql`SELECT id FROM events WHERE slug = ${slug}`;
    if (existing.length > 0) {
      slug = `${slug}-${nanoid(6).toLowerCase()}`;
    }

    const [event] = await sql`
      INSERT INTO events (organizer_id, title, slug, description, category, venue_name, venue_address, start_at, end_at, status, cover_image_url)
      VALUES (${session.userId}, ${title}, ${slug}, ${description ?? null}, ${category ?? null}, ${venueName}, ${venueAddress ?? null}, ${startAt}, ${endAt ?? null}, 'draft', ${coverImageUrl ?? null})
      RETURNING id, slug
    `;

    for (const tt of ticketTypes) {
      await sql`
        INSERT INTO ticket_types (event_id, name, price_kes, quantity_total, max_per_order)
        VALUES (${event.id}, ${tt.name}, ${tt.priceKes}, ${tt.quantityTotal}, ${tt.maxPerOrder ?? 10})
      `;
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error('Create event error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
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

  if (session.role === 'organizer') {
    // Check live DB state, not just the session cookie — a suspension should
    // take effect immediately, even if the organizer is already logged in
    // with a still-valid session from before they were suspended.
    const [account] = await sql`
      SELECT u.status, COALESCE(op.is_verified, false) AS is_verified
      FROM users u
      LEFT JOIN organizer_profiles op ON op.user_id = u.id
      WHERE u.id = ${session.userId}
    `;

    if (!account || account.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your account has been suspended. Contact support for help.' },
        { status: 403 }
      );
    }

    if (!account.is_verified) {
      return NextResponse.json(
        { error: 'Your organizer account is pending admin approval. You will be able to create events once approved.' },
        { status: 403 }
      );
    }
  }

  try {
    const body = await req.json();
    const { title, description, category, venueName, venueAddress, startAt, endAt, coverImageUrl, ticketTypes, publishNow } = body;

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

    let slug = slugify(title);
    const existing = await sql`SELECT id FROM events WHERE slug = ${slug}`;
    if (existing.length > 0) {
      slug = `${slug}-${nanoid(6).toLowerCase()}`;
    }

    const initialStatus = publishNow ? (session.role === 'admin' ? 'published' : 'pending_review') : 'draft';

    const [event] = await sql`
      INSERT INTO events (organizer_id, title, slug, description, category, venue_name, venue_address, start_at, end_at, status, cover_image_url)
      VALUES (${session.userId}, ${title}, ${slug}, ${description ?? null}, ${category ?? null}, ${venueName}, ${venueAddress ?? null}, ${startAt}, ${endAt ?? null}, ${initialStatus}, ${coverImageUrl ?? null})
      RETURNING id, slug, status
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

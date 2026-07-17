import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      title,
      description,
      category,
      venueName,
      venueAddress,
      startAt,
      endAt,
      coverImageUrl,
      ticketTypes,
      organizerId,
    } = await req.json();

    if (!title || !venueName || !startAt || !organizerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert the event using the specified organizerId
    const [event] = await sql`
      INSERT INTO events (
        title, description, category, venue_name, venue_address, 
        start_at, end_at, cover_image_url, organizer_id, status
      ) VALUES (
        ${title}, ${description}, ${category}, ${venueName}, ${venueAddress}, 
        ${startAt}, ${endAt}, ${coverImageUrl}, ${organizerId}, 'draft'
      )
      RETURNING id
    `;

    // Insert the corresponding ticket types
    if (ticketTypes && ticketTypes.length > 0) {
      for (const tt of ticketTypes) {
        await sql`
          INSERT INTO ticket_types (
            event_id, name, price_kes, quantity_total, quantity_sold
          ) VALUES (
            ${event.id}, ${tt.name}, ${tt.priceKes}, ${tt.quantityTotal}, 0
          )
        `;
      }
    }

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  const [event] = await sql`
    SELECT title, description, category, venue_name, venue_address, cover_image_url, organizer_id
    FROM events WHERE id = ${id}
  `;

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
  }

  const ticketTypes = await sql`
    SELECT name, price_kes, quantity_total FROM ticket_types WHERE event_id = ${id} ORDER BY price_kes ASC
  `;

  return NextResponse.json({
    title: `Copy of ${event.title}`,
    description: event.description || '',
    category: event.category || '',
    venueName: event.venue_name || '',
    venueAddress: event.venue_address || '',
    coverImageUrl: event.cover_image_url || '',
    ticketTypes: ticketTypes.map((tt) => ({
      name: tt.name,
      priceKes: String(tt.price_kes),
      quantityTotal: String(tt.quantity_total),
    })),
  });
}

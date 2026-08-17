import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await sql`
      SELECT event_id FROM event_favorites WHERE user_id = ${session.userId}
    `;
    return NextResponse.json({
      eventIds: rows.map((r) => r.event_id as string),
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('event_favorites') || msg.includes('does not exist')) {
      return NextResponse.json({
        eventIds: [],
        error: 'Favorites table not set up. Run migrations/008_event_favorites.sql',
      });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Please log in to save events' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const eventId = String(body.eventId || '').trim();
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  try {
    const [event] = await sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`;
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existing = await sql`
      SELECT user_id FROM event_favorites
      WHERE user_id = ${session.userId} AND event_id = ${eventId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        DELETE FROM event_favorites
        WHERE user_id = ${session.userId} AND event_id = ${eventId}
      `;
      return NextResponse.json({ favorited: false });
    }

    await sql`
      INSERT INTO event_favorites (user_id, event_id)
      VALUES (${session.userId}, ${eventId})
      ON CONFLICT DO NOTHING
    `;
    return NextResponse.json({ favorited: true });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('event_favorites') || msg.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Favorites not set up. Run migrations/008_event_favorites.sql on the database.' },
        { status: 503 }
      );
    }
    throw err;
  }
}
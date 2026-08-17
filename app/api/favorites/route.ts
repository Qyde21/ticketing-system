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
      SELECT event_id FROM event_favorites WHERE user_id = ${String(session.userId)}
    `;
    return NextResponse.json({ eventIds: rows.map((r) => String(r.event_id)) });
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('favorites GET:', msg);
    return NextResponse.json({ eventIds: [], error: msg, detail: msg }, { status: 503 });
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

  const wantFavorited =
    typeof body.favorited === 'boolean' ? body.favorited : true;

  const userId = String(session.userId);

  try {
    const [event] = await sql`SELECT id::text AS id FROM events WHERE id::text = ${eventId} LIMIT 1`;
    if (!event) {
      return NextResponse.json({ error: 'Event not found', eventId }, { status: 404 });
    }
    const eventIdStr = String(event.id);

    if (wantFavorited) {
      await sql`
        INSERT INTO event_favorites (user_id, event_id)
        VALUES (${userId}, ${eventIdStr})
        ON CONFLICT (user_id, event_id) DO NOTHING
      `;
      return NextResponse.json({ favorited: true });
    }

    await sql`
      DELETE FROM event_favorites
      WHERE user_id = ${userId} AND event_id = ${eventIdStr}
    `;
    return NextResponse.json({ favorited: false });
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('favorites POST error:', msg);
    return NextResponse.json(
      { error: 'Could not update favorite', detail: msg, userId, eventId },
      { status: 503 }
    );
  }
}
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
      eventIds: rows.map((r) => String(r.event_id)),
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('favorites GET:', msg);
    return NextResponse.json({ eventIds: [], error: msg }, { status: 503 });
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
    typeof body.favorited === 'boolean' ? body.favorited : null;

  try {
    const [event] = await sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`;
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const userId = String(session.userId);
    const eventIdStr = String(event.id);

    const existing = await sql`
      SELECT user_id FROM event_favorites
      WHERE user_id = ${userId} AND event_id = ${eventIdStr}
      LIMIT 1
    `;
    const isFavorited = existing.length > 0;
    const next = wantFavorited === null ? !isFavorited : wantFavorited;

    if (next && !isFavorited) {
      await sql`
        INSERT INTO event_favorites (user_id, event_id)
        VALUES (${userId}, ${eventIdStr})
        ON CONFLICT (user_id, event_id) DO NOTHING
      `;
    } else if (!next && isFavorited) {
      await sql`
        DELETE FROM event_favorites
        WHERE user_id = ${userId} AND event_id = ${eventIdStr}
      `;
    }

    return NextResponse.json({ favorited: next });
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('favorites POST error:', msg);
    return NextResponse.json(
      {
        error: 'Could not update favorite',
        detail: msg,
      },
      { status: 503 }
    );
  }
}
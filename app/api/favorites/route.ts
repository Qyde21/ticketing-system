import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function ensureFavoritesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS event_favorites (
      user_id    TEXT NOT NULL,
      event_id   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, event_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_event_favorites_user_id ON event_favorites(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_event_favorites_event_id ON event_favorites(event_id)`;
}

function isMissingTableError(msg: string) {
  const m = msg.toLowerCase();
  return m.includes('event_favorites') && (m.includes('does not exist') || m.includes('undefined_table'));
}

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = String(session.userId);

  async function load() {
    const rows = await sql`
      SELECT event_id FROM event_favorites WHERE user_id = ${userId}
    `;
    return rows.map((r) => String(r.event_id));
  }

  try {
    return NextResponse.json({ eventIds: await load() });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (isMissingTableError(msg)) {
      try {
        await ensureFavoritesTable();
        return NextResponse.json({ eventIds: await load() });
      } catch (err2: any) {
        const msg2 = String(err2?.message || err2);
        console.error('favorites GET after ensure:', msg2);
        return NextResponse.json({ eventIds: [], detail: msg2 }, { status: 503 });
      }
    }
    console.error('favorites GET:', msg);
    return NextResponse.json({ eventIds: [], detail: msg }, { status: 503 });
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

  async function run() {
    const [event] = await sql`
      SELECT id::text AS id FROM events WHERE id::text = ${eventId} LIMIT 1
    `;
    if (!event) {
      return { status: 404 as const, body: { error: 'Event not found', eventId } };
    }
    const eventIdStr = String(event.id);

    if (wantFavorited) {
      await sql`
        INSERT INTO event_favorites (user_id, event_id)
        VALUES (${userId}, ${eventIdStr})
        ON CONFLICT (user_id, event_id) DO NOTHING
      `;
      return { status: 200 as const, body: { favorited: true } };
    }

    await sql`
      DELETE FROM event_favorites
      WHERE user_id = ${userId} AND event_id = ${eventIdStr}
    `;
    return { status: 200 as const, body: { favorited: false } };
  }

  try {
    const result = await run();
    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (isMissingTableError(msg)) {
      try {
        await ensureFavoritesTable();
        const result = await run();
        return NextResponse.json(result.body, { status: result.status });
      } catch (err2: any) {
        const msg2 = String(err2?.message || err2);
        console.error('favorites POST after ensure:', msg2);
        return NextResponse.json(
          { error: 'Could not update favorite', detail: msg2 },
          { status: 503 }
        );
      }
    }
    console.error('favorites POST error:', msg);
    return NextResponse.json(
      { error: 'Could not update favorite', detail: msg, userId, eventId },
      { status: 503 }
    );
  }
}
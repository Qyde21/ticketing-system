import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || '';
  const setupKey = process.env.FAVORITES_SETUP_KEY || '';

  if (!setupKey || key !== setupKey) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        hint: 'POST /api/setup/favorites?key=YOUR_FAVORITES_SETUP_KEY',
      },
      { status: 403 }
    );
  }

  try {
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

    const check = await sql`
      SELECT to_regclass('public.event_favorites')::text AS name
    `;

    return NextResponse.json({
      ok: true,
      table: check[0]?.name || null,
      message: 'event_favorites is ready on the production database',
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('setup favorites:', msg);
    return NextResponse.json({ ok: false, detail: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
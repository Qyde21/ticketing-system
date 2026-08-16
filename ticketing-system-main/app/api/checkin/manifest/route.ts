import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function authorizeForEvent(session: { userId: string; role: string }, eventId: string) {
  const [event] = await sql`
    SELECT id, title, organizer_id, status, start_at, end_at FROM events WHERE id = ${eventId}
  `;
  if (!event) return { ok: false as const, status: 404 as const, error: 'Event not found' };
  if (session.role === 'admin' || event.organizer_id === session.userId) {
    return { ok: true as const, event };
  }
  const staff = await sql`
    SELECT event_id FROM event_staff
    WHERE event_id = ${eventId} AND user_id = ${session.userId}
    LIMIT 1
  `;
  if (staff.length > 0) return { ok: true as const, event };
  return { ok: false as const, status: 403 as const, error: 'Not authorized for this event' };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const eventId = req.nextUrl.searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const auth = await authorizeForEvent(session, eventId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tickets = await sql`
    SELECT
      UPPER(t.ticket_code) AS code,
      t.status,
      t.holder_name,
      tt.name AS ticket_type
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE tt.event_id = ${eventId}
    ORDER BY t.ticket_code ASC
  `;

  return NextResponse.json(
    {
      eventId,
      eventTitle: auth.event.title as string,
      downloadedAt: new Date().toISOString(),
      tickets: tickets.map((t) => ({
        code: t.code as string,
        status: t.status as string,
        holderName: (t.holder_name as string) || null,
        ticketType: (t.ticket_type as string) || null,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
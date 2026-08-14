import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function authorizeForEvent(session: { userId: string; role: string }, eventId: string) {
  const [event] = await sql`
    SELECT id, organizer_id, status, start_at, end_at FROM events WHERE id = ${eventId}
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

function isEventEnded(event: { status?: string; start_at?: string | Date; end_at?: string | Date | null } | Record<string, any>) {
  if (!event) return false;
  if (event.status === 'completed') return true;
  if (event.status === 'cancelled') return false;
  const start = event.start_at;
  if (!start && !event.end_at) return false;
  const end = event.end_at ? new Date(event.end_at as string | Date) : new Date(start as string | Date);
  return end < new Date();
}


async function getLiveStats(eventId: string) {
  const [counts] = await sql`
    SELECT
      COUNT(t.id)::int AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'used')::int AS checked_in,
      COUNT(t.id) FILTER (WHERE t.status = 'valid')::int AS remaining,
      COUNT(t.id) FILTER (WHERE t.status = 'cancelled')::int AS cancelled
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE tt.event_id = ${eventId}
  `;
  const recent = await sql`
    SELECT
      t.ticket_code,
      t.holder_name,
      t.checked_in_at,
      tt.name AS ticket_type,
      u.full_name AS scanned_by_name,
      u.email AS scanned_by_email
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    LEFT JOIN users u ON u.id = t.checked_in_by
    WHERE tt.event_id = ${eventId} AND t.status = 'used' AND t.checked_in_at IS NOT NULL
    ORDER BY t.checked_in_at DESC
    LIMIT 50
  `;
  const byStaff = await sql`
    SELECT
      COALESCE(u.full_name, 'Unknown') AS name,
      COALESCE(u.email, '') AS email,
      COUNT(*)::int AS count
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    LEFT JOIN users u ON u.id = t.checked_in_by
    WHERE tt.event_id = ${eventId} AND t.status = 'used' AND t.checked_in_at IS NOT NULL
    GROUP BY u.id, u.full_name, u.email
    ORDER BY count DESC, name ASC
  `;
  return {
    total: Number(counts?.total ?? 0),
    checkedIn: Number(counts?.checked_in ?? 0),
    remaining: Number(counts?.remaining ?? 0),
    cancelled: Number(counts?.cancelled ?? 0),
    recent: recent.map((r) => ({
      ticketCode: r.ticket_code as string,
      holderName: (r.holder_name as string) || null,
      ticketType: (r.ticket_type as string) || null,
      checkedInAt: r.checked_in_at ? new Date(r.checked_in_at as string).toISOString() : null,
      scannedBy: (r.scanned_by_name as string) || null,
      scannedByEmail: (r.scanned_by_email as string) || null,
    })),
    byStaff: byStaff.map((r) => ({
      name: r.name as string,
      email: (r.email as string) || null,
      count: Number(r.count) || 0,
    })),
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  const eventId = req.nextUrl.searchParams.get('eventId');
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  const auth = await authorizeForEvent(session, eventId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const stats = await getLiveStats(eventId);
  return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  try {
    const body = await req.json();
    const eventId = body.eventId as string;
    const rawCode = typeof body.ticketCode === 'string' ? body.ticketCode.trim() : '';
    const ticketCode = rawCode.includes('/')
      ? rawCode.split('/').filter(Boolean).pop()!.toUpperCase()
      : rawCode.toUpperCase();
    if (!ticketCode || !eventId) {
      return NextResponse.json({ error: 'Missing ticket code or event' }, { status: 400 });
    }
    const auth = await authorizeForEvent(session, eventId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (isEventEnded(auth.event)) {
      return NextResponse.json(
        { error: 'This event has ended. Ticket scanning is closed.', stats: await getLiveStats(eventId) },
        { status: 403 }
      );
    }
    const [ticket] = await sql`
      SELECT t.id, t.status, t.holder_name, t.checked_in_at, tt.event_id, tt.name AS ticket_type
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE UPPER(t.ticket_code) = ${ticketCode}
    `;
    if (!ticket) {
      return NextResponse.json({ error: 'Invalid ticket code', stats: await getLiveStats(eventId) }, { status: 404 });
    }
    if (ticket.event_id !== eventId) {
      return NextResponse.json({ error: 'Ticket is for a different event' }, { status: 400 });
    }
    if (ticket.status === 'cancelled') {
      return NextResponse.json({ error: 'Ticket has been cancelled', holderName: ticket.holder_name }, { status: 400 });
    }
    if (ticket.status === 'used') {
      const when = ticket.checked_in_at ? new Date(ticket.checked_in_at as string).toLocaleTimeString() : 'earlier';
      return NextResponse.json({
        error: `Already checked in at ${when}`,
        holderName: ticket.holder_name,
        alreadyCheckedIn: true,
        stats: await getLiveStats(eventId),
      }, { status: 409 });
    }

    const updated = await sql`
      UPDATE tickets
      SET status = 'used', checked_in_at = now(), checked_in_by = ${session.userId}
      WHERE id = ${ticket.id} AND status = 'valid'
      RETURNING id, holder_name, checked_in_at
    `;
    if (updated.length === 0) {
      const [again] = await sql`SELECT holder_name, checked_in_at FROM tickets WHERE id = ${ticket.id}`;
      const when = again?.checked_in_at ? new Date(again.checked_in_at as string).toLocaleTimeString() : 'just now';
      return NextResponse.json({
        error: `Already checked in at ${when}`,
        holderName: again?.holder_name,
        alreadyCheckedIn: true,
        stats: await getLiveStats(eventId),
      }, { status: 409 });
    }

    const stats = await getLiveStats(eventId);
    return NextResponse.json({
      message: 'Checked in successfully',
      holderName: updated[0].holder_name,
      ticketType: ticket.ticket_type,
      checkedInAt: updated[0].checked_in_at
        ? new Date(updated[0].checked_in_at as string).toISOString()
        : new Date().toISOString(),
      stats,
    });
  } catch (err) {
    console.error('Checkin error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

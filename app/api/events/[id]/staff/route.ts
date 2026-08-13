import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
function isEventEnded(event: { status?: string; start_at?: string | Date; end_at?: string | Date | null }) {
  if (event.status === 'completed') return true;
  if (event.status === 'cancelled') return false;
  const end = event.end_at ? new Date(event.end_at) : event.start_at ? new Date(event.start_at) : null;
  return !!end && end < new Date();
}


async function assertOrganizerOrAdmin(eventId: string, userId: string, role: string) {
  const [event] = await sql`
    SELECT id, title, organizer_id, status, start_at, end_at FROM events WHERE id = ${eventId}
  `;
  if (!event) return { error: 'Event not found', status: 404 as const };
  if (event.organizer_id !== userId && role !== 'admin') {
    return { error: 'Not authorized for this event', status: 403 as const };
  }
  return { event };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: eventId } = await params;
  const check = await assertOrganizerOrAdmin(eventId, session.userId, session.role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const staff = await sql`
    SELECT u.id, u.full_name, u.email
    FROM event_staff es
    JOIN users u ON u.id = es.user_id
    WHERE es.event_id = ${eventId}
    ORDER BY u.full_name ASC
  `;
  return NextResponse.json({ staff });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: eventId } = await params;
  const check = await assertOrganizerOrAdmin(eventId, session.userId, session.role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });
  if (isEventEnded(check.event)) {
    return NextResponse.json({ error: 'This event has ended. Door staff changes are closed.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const [user] = await sql`
    SELECT id, full_name, email, status FROM users WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (!user) {
    return NextResponse.json({
      error: 'No TicketHub account found for that email. Ask them to sign up first, then invite again.',
    }, { status: 404 });
  }
  if (user.status === 'suspended') {
    return NextResponse.json({ error: 'That account is suspended' }, { status: 400 });
  }
  if (user.id === check.event.organizer_id) {
    return NextResponse.json({ error: 'The organizer already has full access to this event' }, { status: 400 });
  }

  const existing = await sql`
    SELECT event_id FROM event_staff
    WHERE event_id = ${eventId} AND user_id = ${user.id}
    LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({
      error: 'That person is already door staff for this event',
      alreadyStaff: true,
      staff: { id: user.id, full_name: user.full_name, email: user.email },
    }, { status: 409 });
  }

  await sql`
    INSERT INTO event_staff (event_id, user_id)
    VALUES (${eventId}, ${user.id})
  `;

  return NextResponse.json({
    success: true,
    staff: { id: user.id, full_name: user.full_name, email: user.email },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: eventId } = await params;
  const check = await assertOrganizerOrAdmin(eventId, session.userId, session.role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });
  if (isEventEnded(check.event)) {
    return NextResponse.json({ error: 'This event has ended. Door staff changes are closed.' }, { status: 400 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await sql`
    DELETE FROM event_staff WHERE event_id = ${eventId} AND user_id = ${userId}
  `;
  return NextResponse.json({ success: true });
}
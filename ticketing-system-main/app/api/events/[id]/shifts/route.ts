import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendShiftAssignedEmail } from '@/lib/email';

function isEventEnded(event: {
  status?: string;
  start_at?: string | Date;
  end_at?: string | Date | null;
}) {
  if (event.status === 'completed') return true;
  if (event.status === 'cancelled') return false;
  const end = event.end_at
    ? new Date(event.end_at)
    : event.start_at
      ? new Date(event.start_at)
      : null;
  return !!end && end < new Date();
}

async function assertOrganizerOrAdmin(eventId: string, userId: string, role: string) {
  const [event] = await sql`
    SELECT id, title, organizer_id, status, start_at, end_at
    FROM events WHERE id = ${eventId}
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

  const shifts = await sql`
    SELECT s.id, s.name, s.starts_at, s.ends_at, s.gate, s.slots_needed, s.created_at
    FROM event_shifts s
    WHERE s.event_id = ${eventId}
    ORDER BY s.starts_at ASC
  `;

  const assignments = await sql`
    SELECT a.shift_id, a.user_id, a.status, u.full_name, u.email
    FROM event_shift_assignments a
    JOIN event_shifts s ON s.id = a.shift_id
    JOIN users u ON u.id = a.user_id
    WHERE s.event_id = ${eventId}
    ORDER BY u.full_name ASC
  `;

  const byShift: Record<string, any[]> = {};
  for (const a of assignments as any[]) {
    const sid = String(a.shift_id);
    if (!byShift[sid]) byShift[sid] = [];
    byShift[sid].push({
      userId: a.user_id,
      fullName: a.full_name,
      email: a.email,
      status: a.status,
    });
  }

  return NextResponse.json({
    shifts: (shifts as any[]).map((s) => ({
      id: s.id,
      name: s.name,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      gate: s.gate,
      slotsNeeded: Number(s.slots_needed),
      assignees: byShift[String(s.id)] || [],
    })),
  });
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
    return NextResponse.json(
      { error: 'This event has ended. Shifts cannot be changed.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'create');

  if (action === 'assign') {
    const shiftId = String(body.shiftId || '');
    const userId = String(body.userId || '');
    if (!shiftId || !userId) {
      return NextResponse.json({ error: 'shiftId and userId are required' }, { status: 400 });
    }
    const [shift] = await sql`
      SELECT id FROM event_shifts WHERE id = ${shiftId} AND event_id = ${eventId}
    `;
    if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });

    const [onStaff] = await sql`
      SELECT user_id FROM event_staff WHERE event_id = ${eventId} AND user_id = ${userId}
    `;
    if (!onStaff) {
      return NextResponse.json(
        { error: 'User must be door staff for this event before assignment' },
        { status: 400 }
      );
    }

    const [shiftRow] = await sql`
      SELECT id, name, starts_at, ends_at, gate FROM event_shifts
      WHERE id = ${shiftId} AND event_id = ${eventId}
    `;
    if (!shiftRow) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });

    const [user] = await sql`
      SELECT id, full_name, email FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await sql`
      INSERT INTO event_shift_assignments (shift_id, user_id, status)
      VALUES (${shiftId}, ${userId}, 'assigned')
      ON CONFLICT (shift_id, user_id) DO NOTHING
    `;

    try {
      const origin = req.nextUrl.origin;
      await sendShiftAssignedEmail({
        toEmail: user.email,
        staffName: user.full_name || 'there',
        eventTitle: check.event.title,
        shiftName: shiftRow.name,
        startsAt: String(shiftRow.starts_at),
        endsAt: String(shiftRow.ends_at),
        gate: shiftRow.gate,
        scanUrl: `${origin}/scan/${eventId}`,
      });
    } catch (err) {
      console.error('Shift assignment email failed:', err);
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'unassign') {
    const shiftId = String(body.shiftId || '');
    const userId = String(body.userId || '');
    if (!shiftId || !userId) {
      return NextResponse.json({ error: 'shiftId and userId are required' }, { status: 400 });
    }
    await sql`
      DELETE FROM event_shift_assignments a
      USING event_shifts s
      WHERE a.shift_id = s.id
        AND a.shift_id = ${shiftId}
        AND a.user_id = ${userId}
        AND s.event_id = ${eventId}
    `;
    return NextResponse.json({ success: true });
  }

  // create shift
  const name = String(body.name || '').trim() || 'Shift';
  const startsAt = String(body.startsAt || '');
  const endsAt = String(body.endsAt || '');
  const gate = body.gate != null ? String(body.gate).trim() || null : null;
  const slotsNeeded = Math.max(1, Number(body.slotsNeeded) || 1);

  if (!startsAt || !endsAt) {
    return NextResponse.json({ error: 'startsAt and endsAt are required' }, { status: 400 });
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO event_shifts (event_id, name, starts_at, ends_at, gate, slots_needed)
    VALUES (${eventId}, ${name}, ${startsAt}, ${endsAt}, ${gate}, ${slotsNeeded})
    RETURNING id, name, starts_at, ends_at, gate, slots_needed
  `;

  return NextResponse.json({
    success: true,
    shift: {
      id: row.id,
      name: row.name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      gate: row.gate,
      slotsNeeded: Number(row.slots_needed),
      assignees: [],
    },
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
    return NextResponse.json(
      { error: 'This event has ended. Shifts cannot be changed.' },
      { status: 400 }
    );
  }

  const shiftId = req.nextUrl.searchParams.get('shiftId');
  if (!shiftId) return NextResponse.json({ error: 'shiftId is required' }, { status: 400 });

  await sql`
    DELETE FROM event_shifts WHERE id = ${shiftId} AND event_id = ${eventId}
  `;
  return NextResponse.json({ success: true });
}
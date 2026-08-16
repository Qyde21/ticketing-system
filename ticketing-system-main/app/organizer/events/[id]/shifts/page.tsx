import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ShiftManager from './ShiftManager';

export const dynamic = 'force-dynamic';

export default async function EventShiftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.userId) redirect('/login');

  const [event] = await sql`
    SELECT id, title, organizer_id, status, start_at, end_at
    FROM events WHERE id = ${id}
  `;
  if (!event) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Event not found.</div>;
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Not authorized for this event.</div>;
  }

  const eventEnded =
    event.status === 'completed' ||
    (event.status !== 'cancelled' &&
      (event.end_at ? new Date(event.end_at as string) : new Date(event.start_at as string)) <
        new Date());

  const staff = await sql`
    SELECT u.id, u.full_name, u.email
    FROM event_staff es
    JOIN users u ON u.id = es.user_id
    WHERE es.event_id = ${id}
    ORDER BY u.full_name ASC
  `;

  const shiftRows = await sql`
    SELECT id, name, starts_at, ends_at, gate, slots_needed
    FROM event_shifts
    WHERE event_id = ${id}
    ORDER BY starts_at ASC
  `;

  const assignmentRows = await sql`
    SELECT a.shift_id, a.user_id, a.status, u.full_name, u.email
    FROM event_shift_assignments a
    JOIN event_shifts s ON s.id = a.shift_id
    JOIN users u ON u.id = a.user_id
    WHERE s.event_id = ${id}
  `;

  const byShift: Record<string, any[]> = {};
  for (const a of assignmentRows as any[]) {
    const sid = String(a.shift_id);
    if (!byShift[sid]) byShift[sid] = [];
    byShift[sid].push({
      userId: a.user_id,
      fullName: a.full_name,
      email: a.email,
      status: a.status,
    });
  }

  const initialShifts = (shiftRows as any[]).map((s) => ({
    id: s.id,
    name: s.name,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    gate: s.gate,
    slotsNeeded: Number(s.slots_needed),
    assignees: byShift[String(s.id)] || [],
  }));

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">Shifts</h1>
      <p className="text-gray-400 text-sm mb-2">{event.title}</p>
      <p className="text-gray-500 text-xs mb-6">
        <Link href={`/organizer/events/${id}/staff`} className="text-indigo-400 hover:underline">
          Door staff
        </Link>
        {' · '}
        <Link href={`/organizer/events/${id}/scan-overview`} className="text-indigo-400 hover:underline">
          Scan overview
        </Link>
      </p>
      <ShiftManager
        eventId={event.id}
        initialShifts={initialShifts}
        staff={staff as any}
        eventEnded={eventEnded}
      />
    </div>
  );
}
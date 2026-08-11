import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import LiveOverview from './LiveOverview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerScanOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const session = await getSession();
  if (!session?.userId) redirect('/login');

  let event = null;
  try {
    if (session.role === 'admin') {
      const results = await sql`SELECT id, title, venue_name, start_at, end_at, status, organizer_id FROM events WHERE id = ${eventId}`;
      event = results[0] || null;
    } else {
      const results = await sql`SELECT id, title, venue_name, start_at, end_at, status, organizer_id FROM events WHERE id = ${eventId} AND organizer_id = ${session.userId}`;
      event = results[0] || null;
    }
  } catch (e) {
    console.error(e);
  }

  if (!event) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-red-950/40 border border-red-800/60 rounded-2xl text-white">
        <h1 className="text-red-400 text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-red-300 text-sm">We couldn&apos;t load this event, or you don&apos;t have permission to view it.</p>
      </div>
    );
  }

  const [counts] = await sql`
    SELECT COUNT(t.id)::int AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'used')::int AS checked_in,
      COUNT(t.id) FILTER (WHERE t.status = 'valid')::int AS remaining,
      COUNT(t.id) FILTER (WHERE t.status = 'cancelled')::int AS cancelled
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE tt.event_id = ${eventId}
  `;
  const recent = await sql`
    SELECT t.ticket_code, t.holder_name, t.checked_in_at, tt.name AS ticket_type
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE tt.event_id = ${eventId} AND t.status = 'used' AND t.checked_in_at IS NOT NULL
    ORDER BY t.checked_in_at DESC
    LIMIT 20
  `;
  const eventEnded =
    event.status === 'completed' ||
    event.status === 'cancelled' ||
    (event.end_at ? new Date(event.end_at) : new Date(event.start_at)) < new Date();

  const initial = {
    total: Number(counts?.total ?? 0),
    checkedIn: Number(counts?.checked_in ?? 0),
    remaining: Number(counts?.remaining ?? 0),
    cancelled: Number(counts?.cancelled ?? 0),
    recent: recent.map((r) => ({
      ticketCode: r.ticket_code as string,
      holderName: (r.holder_name as string) || null,
      ticketType: (r.ticket_type as string) || null,
      checkedInAt: r.checked_in_at ? new Date(r.checked_in_at as string).toISOString() : null,
    })),
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link
        href={session.role === 'admin' ? `/admin/organizers/${event.organizer_id}/events` : `/organizer/dashboard`}
        className="text-sm text-indigo-400 hover:underline"
      >
        &larr; Back
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
        <div>
          <h1 className="text-2xl font-extrabold">{event.title}</h1>
          <p className="text-gray-400 text-sm">
            {event.venue_name || 'No Venue'} &middot;{' '}
            {event.start_at ? new Date(event.start_at).toLocaleString() : 'No Date'}
          </p>
        </div>
        <a
          href={`/api/events/${eventId}/door-list`}
          className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg border border-gray-700 transition"
        >
          Download door list (CSV)
        </a>
      </div>
      <LiveOverview eventId={eventId} initial={initial} eventEnded={eventEnded} />
    </div>
  );
}
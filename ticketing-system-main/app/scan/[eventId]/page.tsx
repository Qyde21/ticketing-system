import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Scanner from './Scanner';

export const dynamic = 'force-dynamic';

export default async function ScanPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await getSession();

  if (!session?.userId) {
    redirect(`/login?next=/scan/${eventId}`);
  }

  const [event] = await sql`
    SELECT id, title, venue_name, start_at, end_at, status, organizer_id
    FROM events WHERE id = ${eventId}
  `;
  if (!event) {
    return <div className="max-w-md mx-auto py-12 px-4 text-white">Event not found.</div>;
  }

  const isAdmin = session.role === 'admin';
  const isOrganizer = event.organizer_id === session.userId;
  let isStaff = false;
  if (!isAdmin && !isOrganizer) {
    const staff = await sql`
      SELECT event_id FROM event_staff
      WHERE event_id = ${eventId} AND user_id = ${session.userId}
      LIMIT 1
    `;
    isStaff = staff.length > 0;
  }

  if (!isAdmin && !isOrganizer && !isStaff) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-white">
        <h1 className="text-xl font-extrabold mb-2">Not authorized</h1>
        <p className="text-gray-400 text-sm">
          You do not have permission to scan tickets for this event.
        </p>
        <Link href="/" className="inline-block mt-4 text-indigo-400 hover:underline text-sm">
          &larr; Back home
        </Link>
      </div>
    );
  }

  const eventEnded =
    event.status === 'completed' ||
    (event.status !== 'cancelled' &&
      (event.end_at ? new Date(event.end_at) : new Date(event.start_at)) < new Date());

  if (eventEnded) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-white">
        <h1 className="text-xl font-extrabold mb-1">Check-in closed</h1>
        <p className="text-gray-400 text-sm mb-4">
          {event.title}{event.venue_name ? ` · ${event.venue_name}` : ''}
        </p>
        <div className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-4 text-sm text-gray-300">
          This event has ended. Ticket scanning is no longer available.
        </div>
        <Link
          href={`/organizer/events/${eventId}/scan-overview`}
          className="inline-block mt-4 text-indigo-400 hover:underline text-sm"
        >
          &larr; Back to scan overview
        </Link>
      </div>
    );
  }

  const [counts] = await sql`
    SELECT COUNT(t.id)::int AS total, COUNT(t.id) FILTER (WHERE t.status = 'used')::int AS checked_in
    FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE tt.event_id = ${eventId}
  `;
  return (
    <div className="max-w-md mx-auto py-8 px-4 text-white">
      <h1 className="text-xl font-extrabold mb-1">Check-in</h1>
      <p className="text-gray-400 text-sm mb-5">
        {event.title}{event.venue_name ? ` · ${event.venue_name}` : ''}
      </p>
      <Scanner
        eventId={event.id}
        initialCheckedIn={Number(counts?.checked_in ?? 0)}
        initialTotal={Number(counts?.total ?? 0)}
      />
    </div>
  );
}
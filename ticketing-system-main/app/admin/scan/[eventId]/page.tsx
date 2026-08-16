import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import LiveOverview from '../../../organizer/events/[id]/scan-overview/LiveOverview';

export const dynamic = 'force-dynamic';

export default async function AdminScanPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Unauthorized access.</div>;
  }

  const { eventId } = await params;

  const [event] = await sql`
    SELECT id, title, venue_name, start_at FROM events WHERE id = ${eventId}
  `;

  if (!event) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Event not found.</div>;
  }

  const [counts] = await sql`
    SELECT COUNT(t.id)::int AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'used')::int AS checked_in,
      COUNT(t.id) FILTER (WHERE t.status = 'valid')::int AS remaining,
      COUNT(t.id) FILTER (WHERE t.status = 'cancelled')::int AS cancelled
    FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE tt.event_id = ${eventId}
  `;
  const recent = await sql`
    SELECT t.ticket_code, t.holder_name, t.checked_in_at, tt.name AS ticket_type
    FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE tt.event_id = ${eventId} AND t.status = 'used' AND t.checked_in_at IS NOT NULL
    ORDER BY t.checked_in_at DESC LIMIT 20
  `;

  const initial = {
    total: Number(counts?.total ?? 0),
    checkedIn: Number(counts?.checked_in ?? 0),
    remaining: Number(counts?.remaining ?? 0),
    cancelled: Number(counts?.cancelled ?? 0),
    recent: recent.map((r: any) => ({
      ticketCode: r.ticket_code as string,
      holderName: (r.holder_name as string) || null,
      ticketType: (r.ticket_type as string) || null,
      checkedInAt: r.checked_in_at ? new Date(r.checked_in_at as string).toISOString() : null,
    })),
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href="/admin/events" className="text-sm text-indigo-400 hover:underline">
        &larr; Back to events
      </Link>
      <h1 className="text-2xl font-extrabold mt-2">{event.title}</h1>
      <p className="text-gray-400 text-sm">
        {event.venue_name || 'No Venue'} &middot; {event.start_at ? new Date(event.start_at).toLocaleString() : 'No Date'}
      </p>
      <LiveOverview eventId={eventId} initial={initial} />
    </div>
  );
}

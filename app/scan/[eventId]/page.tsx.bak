import { sql } from '@/lib/db';
import Scanner from './Scanner';

export const dynamic = 'force-dynamic';

export default async function ScanPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event] = await sql`SELECT id, title, venue_name, start_at FROM events WHERE id = ${eventId}`;
  if (!event) return <div className="max-w-md mx-auto py-12 px-4 text-white">Event not found.</div>;
  const [counts] = await sql`
    SELECT COUNT(t.id)::int AS total, COUNT(t.id) FILTER (WHERE t.status = 'used')::int AS checked_in
    FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE tt.event_id = ${eventId}
  `;
  return (
    <div className="max-w-md mx-auto py-8 px-4 text-white">
      <h1 className="text-xl font-extrabold mb-1">Check-in</h1>
      <p className="text-gray-400 text-sm mb-5">{event.title}{event.venue_name ? ` · ${event.venue_name}` : ''}</p>
      <Scanner eventId={event.id} initialCheckedIn={Number(counts?.checked_in ?? 0)} initialTotal={Number(counts?.total ?? 0)} />
    </div>
  );
}

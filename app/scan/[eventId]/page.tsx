import { sql } from '@/lib/db';
import Scanner from './Scanner';

export const dynamic = 'force-dynamic';

export default async function ScanPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [event] = await sql`SELECT id, title FROM events WHERE id = ${eventId}`;

  if (!event) {
    return <div className="max-w-md mx-auto py-12 px-4 text-white">Event not found.</div>;
  }

  const [counts] = await sql`
    SELECT
      COUNT(t.id) AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'used') AS checked_in,
      COUNT(t.id) FILTER (WHERE t.status = 'valid') AS remaining
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE tt.event_id = ${eventId}
  `;

  return (
    <div className="max-w-md mx-auto py-8 px-4 text-white">
      <h1 className="text-xl font-extrabold mb-4">Check-in: {event.title}</h1>

      {/* Live counter */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{counts.checked_in}</div>
          <div className="text-xs text-gray-400 mt-0.5">Checked in</div>
        </div>
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{counts.remaining}</div>
          <div className="text-xs text-gray-400 mt-0.5">Not yet in</div>
        </div>
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-indigo-400">{counts.total}</div>
          <div className="text-xs text-gray-400 mt-0.5">Total</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-800 rounded-full overflow-hidden mb-5" style={{ height: 8 }}>
        <div className="bg-emerald-500 h-full transition-all" style={{ width: (Number(counts.total) > 0 ? Math.round((Number(counts.checked_in) / Number(counts.total)) * 100) : 0) + '%' }} />
      </div>

      <Scanner eventId={event.id} initialCheckedIn={Number(counts.checked_in)} initialTotal={Number(counts.total)} />
    </div>
  );
}
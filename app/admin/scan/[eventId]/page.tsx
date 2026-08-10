import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import LocalTime from '@/components/LocalTime';

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

  const tickets = await sql`
    SELECT t.ticket_code, t.status, t.holder_name, t.checked_in_at,
           tt.name AS ticket_type
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN orders o ON o.id = t.order_id
    WHERE o.event_id = ${eventId}
    ORDER BY t.checked_in_at DESC NULLS LAST
  `;

  const total = tickets.length;
  const checkedIn = tickets.filter((t: any) => t.status === 'used').length;
  const valid = tickets.filter((t: any) => t.status === 'valid').length;
  const cancelled = tickets.filter((t: any) => t.status === 'cancelled').length;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href="/admin/events" className="text-sm text-indigo-400 hover:underline">Back to events</Link>
      <h1 className="text-2xl font-extrabold mt-2">{event.title}</h1>
      <p className="text-gray-400 text-sm">{event.venue_name} &middot; {new Date(event.start_at).toLocaleString()}</p>

      <div className="flex gap-3 mt-4 flex-wrap">
        {[
          { label: 'Total tickets', value: total, color: 'text-indigo-400' },
          { label: 'Checked in', value: checkedIn, color: 'text-emerald-400' },
          { label: 'Not yet in', value: valid, color: 'text-amber-400' },
          { label: 'Cancelled', value: cancelled, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-center" style={{ minWidth: 120 }}>
            <div className={'text-2xl font-bold ' + stat.color}>{stat.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-gray-800 rounded-full overflow-hidden" style={{ height: 8 }}>
        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${total > 0 ? (checkedIn / total) * 100 : 0}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {total > 0 ? Math.round((checkedIn / total) * 100) : 0}% checked in
      </p>

      <Link
        href={`/scan/${eventId}`}
        className="inline-block mt-3 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-semibold text-sm transition"
      >
        Open Scanner
      </Link>

      <h2 className="text-xl font-bold mt-6 mb-3">Tickets</h2>
      <ul className="list-none p-0">
        {tickets.map((t: any) => (
          <li key={t.ticket_code} className="flex justify-between items-center px-3 py-2.5 mb-2 bg-gray-900 border border-gray-800 rounded-xl">
            <div>
              <strong className="text-sm text-white">{t.ticket_code}</strong>
              <div className="text-xs text-gray-400">{t.holder_name} &middot; {t.ticket_type}</div>
              {t.checked_in_at && (
                <div className="text-xs text-emerald-400 font-medium">
                  Checked in: <LocalTime isoString={t.checked_in_at.toISOString()} />
                </div>
              )}
            </div>
            <span
              className={
                'text-xs font-semibold px-2 py-0.5 rounded-full ' +
                (t.status === 'used'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                  : t.status === 'cancelled'
                  ? 'bg-red-950/60 text-red-300 border border-red-800/50'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/50')
              }
            >
              {t.status === 'used' ? 'Checked in' : t.status === 'cancelled' ? 'Cancelled' : 'Valid'}
            </span>
          </li>
        ))}
        {tickets.length === 0 && <p className="text-gray-400">No tickets sold yet.</p>}
      </ul>
    </div>
  );
}

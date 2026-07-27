import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizerScanOverviewPage({ params }: PageProps) {
  const resolvedParams = await params;
  const eventId = resolvedParams.id;

  const session = await getSession();

  if (!session || !session.userId) {
    redirect('/login');
  }

  const userId = session.userId;
  const userRole = session.role;

  let event = null;

  try {
    if (userRole === 'admin') {
      const results = await sql`
        SELECT id, title, venue_name, start_at, organizer_id
        FROM events
        WHERE id = ${eventId}
      `;
      if (results && results.length > 0) {
        event = results[0];
      }
    } else {
      const results = await sql`
        SELECT id, title, venue_name, start_at, organizer_id
        FROM events
        WHERE id = ${eventId} AND organizer_id = ${userId}
      `;
      if (results && results.length > 0) {
        event = results[0];
      }
    }
  } catch (error) {
    console.error("Database query failed:", error);
  }

  if (!event) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-red-950/40 border border-red-800/60 rounded-2xl text-white">
        <h1 className="text-red-400 text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-red-300 text-sm">
          We couldn&apos;t load this event, or you don&apos;t have permission to view it.
        </p>
        <div className="mt-5">
          <Link href="/admin/events" className="text-indigo-400 hover:underline font-semibold text-sm">
            &larr; Return to Event List
          </Link>
        </div>
      </div>
    );
  }

  const tickets = await sql`
    SELECT t.ticket_code, t.status, t.holder_name, t.checked_in_at,
           tt.name AS ticket_type
    FROM tickets t
    LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
    LEFT JOIN orders o ON o.id = t.order_id
    WHERE o.event_id = ${eventId}
    ORDER BY t.checked_in_at DESC NULLS LAST
  `;

  const total = tickets.length;
  const checkedIn = tickets.filter((t: any) => t.status === 'used').length;
  const valid = tickets.filter((t: any) => t.status === 'valid').length;
  const cancelled = tickets.filter((t: any) => t.status === 'cancelled').length;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href={userRole === 'admin' ? `/admin/organizers/${event.organizer_id}/events` : `/organizer/dashboard`} className="text-sm text-indigo-400 hover:underline">
        &larr; Back to {userRole === 'admin' ? 'events list' : 'dashboard'}
      </Link>
      <h1 className="text-2xl font-extrabold mt-2">{event.title}</h1>
      <p className="text-gray-400 text-sm">{event.venue_name || 'No Venue Specified'} &middot; {event.start_at ? new Date(event.start_at).toLocaleString() : 'No Date'}</p>

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
              <div className="text-xs text-gray-400">{t.holder_name || 'Anonymous'} &middot; {t.ticket_type || 'Standard'}</div>
              {t.checked_in_at && (
                <div className="text-xs text-emerald-400">
                  Checked in: {new Date(t.checked_in_at).toLocaleTimeString()}
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

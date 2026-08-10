import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import ShareTicket from './ShareTicket';
import TransferTicketButton from './TransferTicketButton';

export const dynamic = 'force-dynamic';

function mapsUrl(lat: number, lng: number) {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}

export default async function AttendeeDashboard() {
  const session = await getSession();
  if (!session) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Please log in to view your dashboard.</div>;
  }

  const lowerEmail = session.email.toLowerCase();

  const [{ count: messageCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM messages WHERE recipient_id = ${session.userId}
  `;

  const orders = await sql`
    SELECT o.id, o.total_amount_kes, o.payment_status, o.created_at, o.quantity,
           e.title, e.venue_name, e.start_at, e.end_at, e.slug, e.cover_image_url,
           e.latitude, e.longitude,
           COALESCE(
             json_agg(json_build_object('code', t.ticket_code, 'status', t.status) ORDER BY t.ticket_code)
             FILTER (WHERE t.id IS NOT NULL),
             '[]'
           ) AS tickets
    FROM orders o
    JOIN events e ON e.id = o.event_id
    LEFT JOIN tickets t ON t.order_id = o.id
    WHERE o.buyer_email = ${lowerEmail}
    AND o.payment_status = 'paid'
    GROUP BY o.id, e.id
    ORDER BY o.created_at DESC
  `;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-3xl font-extrabold">My Tickets</h1>
        <Link
          href="/inbox"
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-2 text-sm font-semibold text-white transition shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Inbox
          {messageCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ minWidth: 20, textAlign: 'center' }}>
              {messageCount}
            </span>
          )}
        </Link>
      </div>
      <p className="text-gray-400 text-sm mb-6">{orders.length} paid order(s)</p>

      {orders.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
          No tickets yet. <Link href="/" className="text-indigo-400 hover:text-cyan-400">Browse events</Link>
        </div>
      )}

      <ul className="space-y-5">
        {orders.map((o: any) => {
          const eventEnded = (o.end_at || o.start_at) ? new Date(o.end_at || o.start_at) < new Date() : false;
          return (
            <li key={o.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {o.cover_image_url && (
                <img src={o.cover_image_url} alt={o.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-5">
                <h2 className="text-lg font-bold text-white mb-1">{o.title}</h2>
                <p className="text-gray-400 text-sm mb-1">{o.venue_name}</p>
                <p className="text-indigo-400 font-semibold text-sm mb-4">
                  {new Date(o.start_at).toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}
                </p>

                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Your tickets ({o.tickets.length}):
                  </p>
                  <div className="flex flex-col gap-2">
                    {o.tickets.map((t: any, index: number) => (
                      <div key={t.code} className="flex flex-wrap items-center gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-500 min-w-[20px]">#{index + 1}</span>
                        <Link href={'/tickets/' + t.code} className="text-indigo-400 hover:text-cyan-400 font-semibold text-sm flex-1">
                          View Ticket
                        </Link>
                        {t.status === 'valid' && !eventEnded && (
                          <ShareTicket code={t.code} eventTitle={o.title} />
                        )}
                        {t.status === 'valid' && !eventEnded && (
                          <TransferTicketButton code={t.code} />
                        )}
                        {t.status === 'used' && (
                          <span className="text-xs text-gray-500 whitespace-nowrap">Checked in</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {o.latitude && o.longitude ? (
                  <a href={mapsUrl(o.latitude, o.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-semibold">
                    View on Google Maps
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">{o.venue_name}</p>
                )}

                <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-sm text-gray-400">
                  <span>KES {Number(o.total_amount_kes).toLocaleString()} &middot; {o.quantity} ticket(s)</span>
                  <span>{new Date(o.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

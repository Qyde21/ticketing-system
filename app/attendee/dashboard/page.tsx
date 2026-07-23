import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import ShareTicket from './ShareTicket';

export const dynamic = 'force-dynamic';

function mapsUrl(lat: number, lng: number) {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}

export default async function AttendeeDashboard() {
  const session = await getSession();
  if (!session) {
    return <div className="max-w-2xl mx-auto py-16 px-4 text-white text-center">Please log in to view your dashboard.</div>;
  }

  const lowerEmail = session.email.toLowerCase();

  const orders = await sql`
    SELECT o.id, o.total_amount_kes, o.payment_status, o.created_at, o.quantity,
           e.title, e.venue_name, e.start_at, e.slug, e.cover_image_url,
           e.latitude, e.longitude,
           array_agg(t.ticket_code) AS ticket_codes
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
      <h1 className="text-3xl font-extrabold mb-1">My Tickets</h1>
      <p className="text-gray-400 text-sm mb-6">{orders.length} paid order(s)</p>

      {orders.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center text-gray-400">
          No tickets yet. <Link href="/" className="text-indigo-400 hover:underline">Browse events</Link>
        </div>
      )}

      <ul className="space-y-5 list-none p-0">
        {orders.map((o: any) => (
          <li key={o.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {o.cover_image_url && (
              <img src={o.cover_image_url} alt={o.title} className="w-full h-40 object-cover" />
            )}
            <div className="p-4">
              <h2 className="text-lg font-bold text-white mb-1">{o.title}</h2>
              <p className="text-gray-400 text-sm mb-1">{o.venue_name}</p>
              <p className="text-indigo-400 font-semibold text-sm mb-3">
                {new Date(o.start_at).toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}
              </p>

              <div className="mb-3">
                <p className="text-xs font-bold text-gray-300 mb-2">
                  Your tickets ({o.ticket_codes.length}):
                </p>
                <div className="flex flex-col gap-2">
                  {o.ticket_codes.map((code: string, index: number) => (
                    <div key={code} className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-500" style={{ minWidth: 20 }}>#{index + 1}</span>
                      <Link href={'/tickets/' + code} className="text-indigo-400 hover:text-cyan-400 font-semibold text-sm flex-1">
                        View Ticket
                      </Link>
                      <ShareTicket code={code} eventTitle={o.title} />
                    </div>
                  ))}
                </div>
              </div>

              {o.latitude && o.longitude ? (
                <a href={mapsUrl(o.latitude, o.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 font-semibold">
                  View on Google Maps
                </a>
              ) : (
                <p className="text-xs text-gray-500 m-0">{o.venue_name}</p>
              )}

              <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-xs text-gray-400">
                <span>KES {Number(o.total_amount_kes).toLocaleString()} &middot; {o.quantity} ticket(s)</span>
                <span>{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

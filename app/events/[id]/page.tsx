import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = await params;
  const identifier = resolvedParams.id;

  let events: any = await sql`
    SELECT * FROM events WHERE id::text = ${identifier} OR slug = ${identifier} LIMIT 1
  `;

  if (!events || (Array.isArray(events) && events.length === 0) || (events.rows && events.rows.length === 0)) {
    events = await sql`
      SELECT * FROM events WHERE LOWER(title) LIKE ${'%' + identifier.replace(/-/g, ' ').toLowerCase() + '%'} LIMIT 1
    `;
  }

  const rows = Array.isArray(events) ? events : (events?.rows || []);

  if (rows.length === 0) {
    notFound();
  }

  const event = rows[0];

  if (!event || !event.id) {
    notFound();
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold
    FROM ticket_types
    WHERE event_id = ${event.id}
    ORDER BY price_kes ASC
  `;

  const eventDate = event.start_at || event.start_date || event.date;
  const eventEndDate = event.end_at || eventDate;
  const isCancelled = event.status === 'cancelled';
  const isEnded = eventEndDate ? new Date(eventEndDate) < new Date() : false;
  const salesClosed = isCancelled || isEnded;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-white">
      <h1 className="text-4xl font-extrabold mb-4">{event.title}</h1>
      <p className="text-gray-300 text-lg mb-8 leading-relaxed">{event.description}</p>

      {isCancelled && (
        <div className="bg-red-950/40 border border-red-800/60 text-red-300 font-semibold px-4 py-3 rounded-xl mb-6">
          This event has been cancelled.
        </div>
      )}
      {!isCancelled && isEnded && (
        <div className="bg-gray-800/60 border border-gray-700 text-gray-300 font-semibold px-4 py-3 rounded-xl mb-6">
          This event has already ended.
        </div>
      )}
      
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 space-y-3">
        <p><strong className="text-gray-400">Date:</strong> {eventDate ? new Date(eventDate).toLocaleString() : 'TBA'}</p>
        <p><strong className="text-gray-400">Location:</strong> {event.venue_name || event.location || 'Online / Venue TBA'}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white mb-2">Tickets</h2>
        {salesClosed ? (
          <p className="text-gray-400">
            {isCancelled ? 'Ticket sales are closed because this event was cancelled.' : 'Ticket sales are closed because this event has ended.'}
          </p>
        ) : ticketTypes.length === 0 ? (
          <p className="text-gray-400">No tickets are available for this event yet.</p>
        ) : (
          ticketTypes.map((t: any) => {
            const total = Number(t.quantity_total || 0);
            const remaining = Math.max(0, total - Number(t.quantity_sold || 0));
            const soldOut = remaining <= 0;
            const percentSold = total > 0 ? Math.floor((Number(t.quantity_sold || 0) / total) * 100) : 0;
            const almostSoldOut = total > 0 && !soldOut && percentSold >= 90;
            return (
              <div key={t.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-xl">
                <div>
                  <p className="font-bold text-white">{t.name}</p>
                  <p className="text-xs text-gray-400">
                    KES {Number(t.price_kes).toLocaleString()} &middot; {soldOut ? 'Sold out' : remaining + ' remaining'}
                    {almostSoldOut && (
                      <span className="text-amber-400 font-bold"> &middot; {percentSold}% sold, almost gone!</span>
                    )}
                  </p>
                </div>
                {soldOut ? (
                  <span className="px-6 py-3 bg-gray-800 text-gray-500 rounded-xl font-bold uppercase tracking-wider text-sm">Sold Out</span>
                ) : (
                  <Link
                    href={`/checkout/${t.id}`}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 text-center text-sm"
                  >
                    Buy Ticket
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

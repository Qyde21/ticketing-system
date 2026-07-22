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

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-white">
      <h1 className="text-4xl font-extrabold mb-4">{event.title}</h1>
      <p className="text-gray-300 text-lg mb-8 leading-relaxed">{event.description}</p>
      
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 space-y-3">
        <p><strong className="text-gray-400">Date:</strong> {eventDate ? new Date(eventDate).toLocaleString() : 'TBA'}</p>
        <p><strong className="text-gray-400">Location:</strong> {event.venue_name || event.location || 'Online / Venue TBA'}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white mb-2">Tickets</h2>
        {ticketTypes.length === 0 && (
          <p className="text-gray-400">No tickets are available for this event yet.</p>
        )}
        {ticketTypes.map((t: any) => {
          const remaining = Math.max(0, Number(t.quantity_total || 0) - Number(t.quantity_sold || 0));
          const soldOut = remaining <= 0;
          return (
            <div key={t.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-xl">
              <div>
                <p className="font-bold text-white">{t.name}</p>
                <p className="text-xs text-gray-400">
                  KES {Number(t.price_kes).toLocaleString()} &middot; {soldOut ? 'Sold out' : `${remaining} remaining`}
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
        })}
      </div>
    </div>
  );
}
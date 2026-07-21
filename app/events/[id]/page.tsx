import { sql } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const eventIdOrSlug = resolvedParams?.id;

  if (!eventIdOrSlug) {
    notFound();
  }

  let event: any = null;
  let ticketTypes: any[] = [];

  try {
    let eventRes = await sql`
      SELECT e.*, COALESCE(u.full_name, 'Organizer') as organizer_name 
      FROM events e 
      LEFT JOIN users u ON u.id::text = e.organizer_id::text 
      WHERE e.id::text = ${eventIdOrSlug} OR e.slug = ${eventIdOrSlug}
    `;

    if (eventRes.length === 0) {
      const cleanSlug = eventIdOrSlug.replace(/-/g, ' ');
      eventRes = await sql`
        SELECT e.*, COALESCE(u.full_name, 'Organizer') as organizer_name 
        FROM events e 
        LEFT JOIN users u ON u.id::text = e.organizer_id::text 
        WHERE LOWER(e.title) LIKE ${'%' + cleanSlug.toLowerCase() + '%'}
        LIMIT 1
      `;
    }

    if (eventRes.length === 0) {
      notFound();
    }

    event = eventRes[0];

    ticketTypes = await sql`
      SELECT * FROM ticket_types WHERE event_id::text = ${String(event.id)}
    `.catch(() => []);

  } catch (err) {
    console.error("Error loading event details:", err);
    notFound();
  }

  const now = new Date();
  const rawEventDate = event.start_at || event.start_date || event.date;
  const eventDate = rawEventDate ? new Date(rawEventDate) : null;
  
  const isEnded = event.status === 'completed' || event.status === 'ended' || (eventDate !== null && !isNaN(eventDate.getTime()) && eventDate < now);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-white">
      <div className="mb-6">
        <Link href="/events" className="text-indigo-400 hover:underline text-sm font-semibold">
          ← Back to Events
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        {(event.cover_image_url || event.image_url) && (
          <div className="w-full h-72 sm:h-96 relative bg-gray-950">
            <img 
              src={event.cover_image_url || event.image_url} 
              alt={event.title} 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{event.title}</h1>
              <p className="text-xs text-indigo-300 mt-1">Organized by {event.organizer_name}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isEnded ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-green-950 text-green-400 border border-green-800'
            }`}>
              {isEnded ? 'Event Ended' : event.status || 'Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-950/60 border border-gray-800/80 p-4 rounded-xl text-sm">
            <div>
              <span className="text-gray-400 block text-xs">Date & Time</span>
              <strong className="text-gray-200">{eventDate && !isNaN(eventDate.getTime()) ? eventDate.toLocaleString() : 'TBD'}</strong>
            </div>
            <div>
              <span className="text-gray-400 block text-xs">Location</span>
              <strong className="text-gray-200">{event.venue_name || event.location || 'Online'}</strong>
            </div>
            <div>
              <span className="text-gray-400 block text-xs">Category</span>
              <strong className="text-gray-200">{event.category || 'General'}</strong>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">About This Event</h2>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-800">
            <h2 className="text-lg font-bold text-white">Ticket Availability</h2>

            {isEnded ? (
              <div className="p-6 bg-gray-950 border border-gray-800 rounded-xl text-center space-y-2">
                <span className="inline-block px-3 py-1 bg-red-950 text-red-400 border border-red-800 rounded-full text-xs font-bold uppercase tracking-wider">
                  Event Ended
                </span>
                <p className="text-gray-400 text-sm">Sales closed for this event.</p>
              </div>
            ) : ticketTypes.length === 0 ? (
              <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl text-gray-400 text-sm text-center">
                No ticket tiers currently listed for this event.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {ticketTypes.map((t: any) => {
                  const priceNum = parseFloat(t.price_kes || 0);
                  const total = t.quantity_total ?? 0;
                  const sold = t.quantity_sold ?? 0;
                  const remaining = Math.max(0, total - sold);
                  const isSoldOut = remaining <= 0;

                  return (
                    <div key={t.id} className="p-4 bg-gray-950 border border-gray-800 rounded-xl flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-white text-base">{t.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {remaining > 0 ? `${remaining} available (${sold} sold)` : 'All tickets sold out'}
                        </p>
                        <span className="text-cyan-400 font-bold text-sm mt-1 block">
                          KES {priceNum.toLocaleString()}
                        </span>
                      </div>

                      <div>
                        {isSoldOut ? (
                          <span className="px-3 py-1 bg-red-950 text-red-400 border border-red-800 rounded-lg text-xs font-bold uppercase tracking-wider">
                            Sold Out
                          </span>
                        ) : (
                          <Link
                            href={`/checkout?ticket_id=${t.id}`}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-green-950/50 block text-center"
                          >
                            Buy Ticket
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
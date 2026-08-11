import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JoinWaitlistButton from '@/components/JoinWaitlistButton';
import FlashSaleCountdown from '@/components/FlashSaleCountdown';

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
    SELECT id, name, price_kes, quantity_total, quantity_sold,
           flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
           flash_sale_quantity_cap, flash_sale_quantity_sold
    FROM ticket_types
    WHERE event_id = ${event.id}
    ORDER BY price_kes ASC
  `;

  const [organizerProfile] = await sql`
    SELECT is_verified FROM organizer_profiles WHERE user_id = ${event.organizer_id}
  `;
  const organizerVerified = organizerProfile?.is_verified === true;

  const eventDate = event.start_at || event.start_date || event.date;
  const eventEndDate = event.end_at || eventDate;
  const isCancelled = event.status === 'cancelled';
  const isEnded = eventEndDate ? new Date(eventEndDate) < new Date() : false;
  const notYetPublished = event.status === 'draft' || event.status === 'pending_review';
  const salesClosed = isCancelled || isEnded || notYetPublished;

  const eventUrl = `https://ticketing-system-phi-eight.vercel.app/events/${event.slug || event.id}`;
  const shareText = `Check out ${event.title} on TicketHub!`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + eventUrl)}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(eventUrl)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-white">
      <h1 className="text-4xl font-extrabold mb-4 flex items-center gap-2 flex-wrap">
        {event.title}
        {organizerVerified && (
          <span className="inline-flex items-center gap-1 bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            Verified Organizer
          </span>
        )}
      </h1>
      <p className="text-gray-300 text-lg mb-6 leading-relaxed">{event.description}</p>

      {!isCancelled && !isEnded && (
        <div className="flex gap-2 mb-8 flex-wrap">
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
            style={{ background: '#25D366' }}
          >
            Share on WhatsApp
          </a>
          <a
            href={twitterShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            Share on X
          </a>
          <a
            href={facebookShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
            style={{ background: '#1877F2' }}
          >
            Share on Facebook
          </a>
        </div>
      )}

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
      {!isCancelled && !isEnded && notYetPublished && (
        <div className="bg-amber-950/40 border border-amber-800/60 text-amber-300 font-semibold px-4 py-3 rounded-xl mb-6">
          This event is not yet live. Ticket sales will open once it has been approved.
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
            {isCancelled
              ? 'Ticket sales are closed because this event was cancelled.'
              : isEnded
              ? 'Ticket sales are closed because this event has ended.'
              : 'Ticket sales will open once this event has been approved.'}
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

            const now = new Date();
            const flashCapReached = t.flash_sale_quantity_cap !== null && t.flash_sale_quantity_cap !== undefined
              && Number(t.flash_sale_quantity_sold || 0) >= Number(t.flash_sale_quantity_cap);
            const flashActive = t.flash_sale_price_kes !== null && t.flash_sale_price_kes !== undefined
              && t.flash_sale_starts_at && t.flash_sale_ends_at
              && now >= new Date(t.flash_sale_starts_at) && now <= new Date(t.flash_sale_ends_at)
              && !flashCapReached;

            return (
              <div key={t.id} className={`flex items-center justify-between bg-gray-900 border p-4 rounded-xl ${flashActive ? "border-amber-500 shadow-lg shadow-amber-500/20" : "border-gray-800"}`}>
                <div>
                  <p className="font-bold text-white flex items-center gap-2">
                    {t.name}
                    {flashActive && (
                      <span className="flash-sale-badge text-[10px] uppercase tracking-wider font-extrabold bg-amber-500 text-black px-2 py-0.5 rounded-full">
                        ⚡ Flash Sale
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {flashActive ? (
                      <>
                        <span className="line-through text-gray-500 mr-1.5">KES {Number(t.price_kes).toLocaleString()}</span>
                        <span className="text-amber-400 font-bold">KES {Number(t.flash_sale_price_kes).toLocaleString()}</span>
                        {' '}
                        <FlashSaleCountdown endsAt={t.flash_sale_ends_at} />
                      </>
                    ) : (
                      <>KES {Number(t.price_kes).toLocaleString()}</>
                    )}
                    {soldOut && <span> &middot; Sold out</span>}
                    {almostSoldOut && (
                      <span className="text-amber-400 font-bold"> &middot; Almost sold out!</span>
                    )}
                  </p>
                </div>
                {soldOut ? (
                  <JoinWaitlistButton ticketTypeId={t.id} />
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

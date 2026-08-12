import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import EventTicketPicker from '@/components/EventTicketPicker';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
    SELECT id, name, price_kes, quantity_total, quantity_sold, max_per_order,
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

  const isCancelled = event.status === 'cancelled';
  const isEnded =
    event.status === 'completed' ||
    (event.end_at ? new Date(event.end_at) : new Date(event.start_at)) < new Date();
  const salesClosed = isCancelled || isEnded || event.status !== 'published';

  const shareUrl = `https://www.mytickethub.co.ke/events/${event.slug || event.id}`;
  const shareText = encodeURIComponent(`${event.title} — get tickets on TicketHub`);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-white">
      {event.cover_image_url && (
        <div className="rounded-2xl overflow-hidden mb-6 border border-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.cover_image_url} alt={event.title} className="w-full max-h-80 object-cover" />
        </div>
      )}

      <h1 className="text-3xl font-extrabold mb-2">{event.title}</h1>
      {organizerVerified && (
        <p className="text-cyan-400 text-sm font-semibold mb-3">Verified Organizer</p>
      )}

      {event.description && (
        <p className="text-gray-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{event.description}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <a
          href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
        >
          Share on WhatsApp
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 text-white border border-gray-700"
        >
          Share on X
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white"
        >
          Share on Facebook
        </a>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-sm space-y-1">
        <p>
          <span className="text-gray-400">Date:</span>{' '}
          {event.start_at ? new Date(event.start_at).toLocaleString() : 'TBA'}
        </p>
        <p>
          <span className="text-gray-400">Location:</span> {event.venue_name || 'TBA'}
        </p>
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
          <EventTicketPicker eventId={event.id} ticketTypes={ticketTypes as any} />
        )}
      </div>
    </div>
  );
}
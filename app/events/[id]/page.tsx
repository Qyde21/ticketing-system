import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JoinWaitlistButton from '@/components/JoinWaitlistButton';
import EventTicketPicker from '@/components/EventTicketPicker';
import FlashSaleCountdown from '@/components/FlashSaleCountdown';
import MessageOrganizerWidget from '@/components/MessageOrganizerWidget';
import ReviewForm from '@/components/ReviewForm';
import FavoriteButton from '@/components/FavoriteButton';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: identifier } = await params;

  let events: any = await sql`
    SELECT title, description, venue_name, start_at, cover_image_url
    FROM events WHERE id::text = ${identifier} OR slug = ${identifier} LIMIT 1
  `;
  const rows = Array.isArray(events) ? events : (events?.rows || []);
  const event = rows[0];

  if (!event) {
    return { title: 'Event not found — TicketHub' };
  }

  const dateStr = event.start_at
    ? new Date(event.start_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const venue = event.venue_name || 'Venue TBA';
  const description = event.description
    ? event.description.slice(0, 160)
    : `${dateStr} at ${venue}. Get your tickets on TicketHub.`;

  return {
    title: `${event.title} — TicketHub`,
    description,
    openGraph: { title: event.title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: event.title, description },
  };
}

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
    SELECT COALESCE(op.business_name, u.full_name) AS organizer_name, COALESCE(op.is_verified, false) AS is_verified
    FROM users u
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    WHERE u.id = ${event.organizer_id}
  `;
  const organizerVerified = organizerProfile?.is_verified === true;
  const organizerName = organizerProfile?.organizer_name as string | undefined;

  const eventDate = event.start_at || event.start_date || event.date;
  const eventEndDate = event.end_at || eventDate;
  const isCancelled = event.status === 'cancelled';
  const isEnded = eventEndDate ? new Date(eventEndDate) < new Date() : false;
  const notYetPublished = event.status === 'draft' || event.status === 'pending_review';
  const salesClosed = isCancelled || isEnded || notYetPublished;

  const eventUrl = `https://www.mytickethub.co.ke/events/${event.slug || event.id}`;

  // A single "does this session's account have a paid ticket for this event"
  // check, reused for both the message-organizer gate (only while the event
  // is still active) and the review gate (only once it's over) — avoids
  // running the same buyer_email lookup twice.
  const session = await getSession();
  let hasPaidTicket = false;
  if (session && session.userId !== event.organizer_id) {
    const [buyerCheck] = await sql`
      SELECT 1 FROM orders
      WHERE event_id = ${event.id} AND payment_status = 'paid' AND LOWER(buyer_email) = ${session.email.toLowerCase()}
      LIMIT 1
    `;
    hasPaidTicket = !!buyerCheck;
  }
  const canMessageOrganizer = hasPaidTicket && !isCancelled && !isEnded;

  let isFavorited = false;
  if (session?.userId) {
    try {
      const [fav] = await sql`
        SELECT user_id FROM event_favorites
        WHERE user_id = ${session.userId} AND event_id = ${event.id}
        LIMIT 1
      `;
      isFavorited = !!fav;
    } catch {
      /* table optional until migration */
    }
  }

  const reviews = await sql`
    SELECT r.id, r.rating, r.comment, r.created_at, u.full_name
    FROM event_reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ${event.id}
    ORDER BY r.created_at DESC
  `;
  const [reviewAgg] = await sql`
    SELECT COUNT(*)::int AS review_count, COALESCE(AVG(rating), 0)::float AS average_rating
    FROM event_reviews WHERE event_id = ${event.id}
  `;
  const reviewCount = reviewAgg?.review_count ?? 0;
  const averageRating = Number(reviewAgg?.average_rating ?? 0);

  let alreadyReviewed = false;
  if (session && hasPaidTicket) {
    const [existing] = await sql`
      SELECT id FROM event_reviews WHERE event_id = ${event.id} AND user_id = ${session.userId} LIMIT 1
    `;
    alreadyReviewed = !!existing;
  }
  const canReview = hasPaidTicket && !isCancelled && isEnded && !alreadyReviewed;
  const shareText = `Check out ${event.title} on TicketHub!`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + eventUrl)}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(eventUrl)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-white">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="text-4xl font-extrabold">{event.title}</h1>
        <FavoriteButton eventId={event.id} initialFavorited={isFavorited} />
      </div>
      {organizerName && (
        <Link
          href={`/organizers/${event.organizer_id}`}
          className="inline-flex items-center gap-1.5 text-gray-300 hover:text-cyan-400 text-sm mb-6"
          style={{ textDecoration: 'none' }}
        >
          by {organizerName}
          {organizerVerified && (
            <span className="inline-flex items-center gap-1 bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
                <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
              Verified Organizer
            </span>
          )}
        </Link>
      )}
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

      {event.venue_name && !isEnded && !isCancelled && (
            <div className="mb-8 rounded-2xl overflow-hidden border border-gray-800">
              <iframe
                title={`Map showing ${event.venue_name}`}
                width="100%"
                height="280"
                style={{ border: 0, display: 'block' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  [event.venue_name, event.venue_address].filter(Boolean).join(', ')
                )}&output=embed`}
              />
            </div>
            )}

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
          <EventTicketPicker
            eventId={String(event.id)}
            ticketTypes={ticketTypes as any[]}
          />
        )}
      </div>

      {canMessageOrganizer && (
        <MessageOrganizerWidget
          eventId={event.id}
          organizerId={event.organizer_id}
          eventTitle={event.title}
        />
      )}
    </div>
  );
}
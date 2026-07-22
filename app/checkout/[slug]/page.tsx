import { sql } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const ticketIdOrSlug = resolvedParams?.slug;

  if (!ticketIdOrSlug) {
    notFound();
  }

  let ticketType: any = null;
  let event: any = null;

  try {
    const ttRes = await sql`
      SELECT tt.*, e.title as event_title, e.start_at, e.start_date, e.date, e.venue_name, e.location, e.cover_image_url, e.image_url
      FROM ticket_types tt
      JOIN events e ON e.id::text = tt.event_id::text
      WHERE tt.id::text = ${ticketIdOrSlug} OR tt.name ILIKE ${ticketIdOrSlug.replace(/-/g, ' ')}
      LIMIT 1
    `;

    if (ttRes.length === 0) {
      notFound();
    }

    ticketType = ttRes[0];
    event = {
      title: ticketType.event_title,
      start_at: ticketType.start_at || ticketType.start_date || ticketType.date,
      venue_name: ticketType.venue_name || ticketType.location,
      cover_image_url: ticketType.cover_image_url || ticketType.image_url
    };

  } catch (err) {
    console.error("Error loading checkout details:", err);
    notFound();
  }

  const priceNum = parseFloat(ticketType.price_kes || 0);
  const total = ticketType.quantity_total ?? 0;
  const sold = ticketType.quantity_sold ?? 0;
  const remaining = Math.max(0, total - sold);

  const eventForForm = {
    id: ticketType.event_id,
    title: event.title,
  };

  const ticketTypesForForm = [
    {
      id: ticketType.id,
      name: ticketType.name,
      price_kes: ticketType.price_kes,
    },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-white">
      <div className="mb-6">
        <Link href={`/events`} className="text-indigo-400 hover:underline text-sm font-semibold">
          ← Back to Events
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/50">
            Checkout
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">{event.title}</h1>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-gray-800">
            <div>
              <h3 className="font-bold text-lg text-white">{ticketType.name} Ticket</h3>
              <p className="text-xs text-gray-400">{remaining} tickets remaining</p>
            </div>
            <span className="text-cyan-400 font-extrabold text-lg">
              KES {priceNum.toLocaleString()}
            </span>
          </div>

          <div className="text-xs text-gray-400 space-y-1">
            <p><strong>Venue:</strong> {event.venue_name || 'TBD'}</p>
            <p><strong>Date:</strong> {event.start_at ? new Date(event.start_at).toLocaleString() : 'TBD'}</p>
          </div>
        </div>

        <CheckoutForm event={eventForForm} ticketTypes={ticketTypesForForm} />
      </div>
    </main>
  );
}

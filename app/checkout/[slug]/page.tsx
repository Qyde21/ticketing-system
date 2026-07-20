import { sql } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import CheckoutForm from "./CheckoutForm";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: PageProps) {
  const { slug } = await params;

  const events = await sql`SELECT * FROM events WHERE id::text = ${slug} OR slug = ${slug}`;
  const event = events[0];

  if (!event) {
    notFound();
  }

  // Fetch ticket types for this event and map price_kes correctly
  const ticketTypesRaw = await sql`SELECT * FROM ticket_types WHERE event_id = ${event.id}`;
  const ticketTypes = ticketTypesRaw.map((t: any) => ({
    ...t,
    price: Number(t.price_kes || t.price || 0)
  }));

  const imageUrl = event.cover_image_url || event.imageUrl;
  const eventDate = event.start_at || event.date;
  const location = event.venue_name || event.location || "Venue TBD";

  const normalizedEvent = {
    ...event,
    ticketTypes: ticketTypes.length > 0 ? ticketTypes : [{ id: "default", name: "Standard Ticket", price: 0 }]
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/events/${event.slug || event.id}`} className="text-blue-600 hover:underline">
          &larr; Back to Event
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Get Tickets</h1>
      <p className="text-gray-600 mb-8">Secure your spot for <span className="font-semibold text-gray-900">{event.title}</span></p>

      <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-100">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-lg">{event.title}</h2>
            <p className="text-sm text-gray-600">{eventDate ? new Date(eventDate).toLocaleString() : "TBD"}</p>
            <p className="text-sm text-gray-600">{location}</p>
          </div>
          {imageUrl && (
            <img src={imageUrl} alt={event.title} className="w-20 h-20 object-cover rounded-md" />
          )}
        </div>
      </div>

      <CheckoutForm event={normalizedEvent} />
    </main>
  );
}
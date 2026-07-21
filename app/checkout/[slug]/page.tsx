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

  // Fetch ticket types and filter out sold out tickets
  const ticketTypesRaw = await sql`SELECT * FROM ticket_types WHERE event_id = ${event.id}`;
  const ticketTypes = ticketTypesRaw
    .map((t: any) => ({
      ...t,
      price: Number(t.price_kes || t.price || 0)
    }))
    .filter((t: any) => {
      const total = Number(t.quantity_total) || 0;
      const sold = Number(t.quantity_sold) || 0;
      const remaining = Math.max(0, total - sold);
      // Keep only tickets that are not sold out (or have unlimited/zero capacity set)
      return total === 0 || remaining > 0;
    });

  const imageUrl = event.cover_image_url || event.imageUrl;
  const eventDate = event.start_at || event.date;
  const location = event.venue_name || event.location || "Venue TBD";

  const normalizedEvent = {
    ...event,
    ticketTypes: ticketTypes.length > 0 ? ticketTypes : [{ id: "default", name: "Standard Ticket", price: 0 }]
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 text-white">
      <div className="mb-6">
        <Link href={`/events/${event.slug || event.id}`} className="text-indigo-400 hover:underline">
          &larr; Back to Event
        </Link>
      </div>

      <h1 className="text-3xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Get Tickets</h1>
      <p className="text-gray-300 mb-8">Secure your spot for <span className="font-semibold text-indigo-300">{event.title}</span></p>

      <div className="bg-gray-900 p-6 rounded-lg mb-8 border border-gray-800 text-white shadow-xl">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-xl text-indigo-300">{event.title}</h2>
            <p className="text-sm text-gray-300 mt-1">{eventDate ? new Date(eventDate).toLocaleString() : "TBD"}</p>
            <p className="text-sm text-gray-300">{location}</p>
          </div>
          {imageUrl && (
            <img src={imageUrl} alt={event.title} className="w-20 h-20 object-cover rounded-md border border-gray-700" />
          )}
        </div>
      </div>

      <CheckoutForm event={normalizedEvent} />
    </main>
  );
}
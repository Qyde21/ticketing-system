import { sql } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;

  const events = await sql`SELECT * FROM events WHERE id::text = ${id} OR slug = ${id}`;
  const event = events[0];

  if (!event) {
    notFound();
  }

  const imageUrl = event.cover_image_url || event.imageUrl;
  const eventDate = event.start_at || event.date;
  const endDate = event.end_at;
  const location = event.venue_name || event.location || "Venue TBD";

  const isEnded = (endDate && new Date(endDate) < new Date()) || event.status === 'completed' || event.status === 'cancelled';

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 text-white">
      <div className="mb-6">
        <Link href="/" className="text-indigo-400 hover:underline">
          &larr; Back to Home
        </Link>
      </div>

      {imageUrl && (
        <div className="w-full h-80 relative mb-6 rounded-lg overflow-hidden bg-gray-900 border border-gray-800 shadow-xl">
          <img src={imageUrl} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{event.title}</h1>
        {isEnded && (
          <span className="bg-red-900 text-red-200 px-3 py-1 rounded-full text-sm font-semibold capitalize border border-red-700">
            {event.status === 'cancelled' ? 'Event Cancelled' : 'Event Ended'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
        <div>
          <p className="text-indigo-300 font-medium text-sm">Date & Time</p>
          <p className="text-lg font-semibold text-white mt-1">{eventDate ? new Date(eventDate).toLocaleString() : "TBD"}</p>
        </div>
        <div>
          <p className="text-indigo-300 font-medium text-sm">Location</p>
          <p className="text-lg font-semibold text-white mt-1">{location}</p>
        </div>
        <div>
          <p className="text-indigo-300 font-medium text-sm">Category</p>
          <p className="text-lg font-semibold text-white mt-1 capitalize">{event.category || "General"}</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-indigo-300">About This Event</h2>
        <p className="text-gray-300 whitespace-pre-line leading-relaxed">{event.description || "No description provided."}</p>
      </div>

      <div>
        {isEnded ? (
          <div className="bg-gray-800 text-gray-400 px-6 py-3 rounded-lg font-semibold inline-block text-center cursor-not-allowed border border-gray-700">
            {event.status === 'cancelled' ? 'Ticket Sales Closed (Event Cancelled)' : 'Ticket Sales Closed (Event Ended)'}
          </div>
        ) : (
          <Link
            href={`/checkout/${event.id}`}
            className="inline-block bg-gradient-to-r from-indigo-600 to-cyan-600 text-white px-8 py-3 rounded-lg font-bold hover:from-indigo-500 hover:to-cyan-500 transition shadow-lg"
          >
            Get Tickets
          </Link>
        )}
      </div>
    </main>
  );
}
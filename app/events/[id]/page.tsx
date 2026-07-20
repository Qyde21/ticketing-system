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
  const location = event.venue_name || event.location || "Venue TBD";

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          &larr; Back to Home
        </Link>
      </div>

      {imageUrl && (
        <div className="w-full h-80 relative mb-6 rounded-lg overflow-hidden bg-gray-100">
          <img src={imageUrl} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      <h1 className="text-3xl font-bold mb-4">{event.title}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-lg">
        <div>
          <p className="text-gray-600 font-medium">Date & Time</p>
          <p className="text-lg">{eventDate ? new Date(eventDate).toLocaleString() : "TBD"}</p>
        </div>
        <div>
          <p className="text-gray-600 font-medium">Location</p>
          <p className="text-lg">{location}</p>
        </div>
        <div>
          <p className="text-gray-600 font-medium">Category</p>
          <p className="text-lg capitalize">{event.category || "General"}</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">About This Event</h2>
        <p className="text-gray-700 whitespace-pre-line">{event.description || "No description provided."}</p>
      </div>

      <div>
        <Link 
          href={`/checkout/${event.id}`} 
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Get Tickets
        </Link>
      </div>
    </main>
  );
}

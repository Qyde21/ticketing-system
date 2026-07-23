import { sql } from '@/lib/db';
import CoverUpload from './CoverUpload';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [event] = await sql`
    SELECT id, title, cover_image_url FROM events WHERE id = ${id}
  `;

  if (!event) {
    return <div className="max-w-md mx-auto py-16 px-4 text-white text-center">Event not found.</div>;
  }

  return (
    <div className="max-w-md mx-auto py-10 px-4 text-white">
      <h1 className="text-2xl font-extrabold mb-1">Edit Cover Image</h1>
      <h2 className="text-gray-400 text-sm mb-4">{event.title}</h2>
      {event.cover_image_url && (
        <img
          src={event.cover_image_url}
          alt="Current cover"
          className="w-full rounded-xl mb-4"
          style={{ maxHeight: 200, objectFit: 'cover' }}
        />
      )}
      {!event.cover_image_url && (
        <p className="text-gray-500 mb-4">No cover image yet.</p>
      )}
      <CoverUpload eventId={event.id} />
    </div>
  );
}

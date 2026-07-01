import { sql } from '@/lib/db';
import CoverUpload from './CoverUpload';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [event] = await sql`
    SELECT id, title, cover_image_url FROM events WHERE id = ${id}
  `;

  if (!event) {
    return <div style={{ margin: '2rem' }}>Event not found.</div>;
  }

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto' }}>
      <h1>Edit Cover Image</h1>
      <h2>{event.title}</h2>
      {event.cover_image_url && (
        <img
          src={event.cover_image_url}
          alt="Current cover"
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
        />
      )}
      {!event.cover_image_url && (
        <p style={{ color: '#888', marginBottom: 16 }}>No cover image yet.</p>
      )}
      <CoverUpload eventId={event.id} />
    </div>
  );
}

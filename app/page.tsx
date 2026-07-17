import { sql } from '@/lib/db';
import EventList from '@/components/EventList';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const events = await sql`
    SELECT id, title, slug, venue_name, start_at, cover_image_url, category 
    FROM events WHERE status = 'published'
  `;

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 16 }}>Events Coming Up</h2>
        <EventList events={events} />
      </div>
    </div>
  );
}

import { sql } from '@/lib/db';
import EventList from '@/components/EventList';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const events = await sql`
    SELECT 
      e.id, e.title, e.slug, e.venue_name, e.start_at, e.cover_image_url, e.category,
      COALESCE(SUM(tt.quantity_total), 0) as total_capacity,
      COALESCE(SUM(tt.quantity_sold), 0) as total_sold
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.status = 'published'
    GROUP BY e.id
    ORDER BY e.start_at ASC
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

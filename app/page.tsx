import { sql } from '@/lib/db';
import EventList from '@/components/EventList';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Query for ALL upcoming events to populate the list and identify the next one
  const events = await sql`
    SELECT 
      e.id, e.title, e.slug, e.venue_name, e.start_at, e.cover_image_url, e.category,
      COALESCE(SUM(tt.quantity_total), 0) as total_capacity,
      COALESCE(SUM(tt.quantity_sold), 0) as total_sold
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.status = 'published' AND e.start_at >= NOW()
    GROUP BY e.id
    ORDER BY e.start_at ASC
  `;

  // The very first item is now guaranteed to be the next upcoming event
  const featuredEvent = events[0];
  const remainingEvents = events.slice(1);

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff', paddingBottom: '2rem' }}>
      {/* Featured Banner */}
      {featuredEvent && (
        <div style={{ position: 'relative', width: '100%', height: 400, marginBottom: 24 }}>
          <img src={featuredEvent.cover_image_url} alt={featuredEvent.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: 0, padding: 20, background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', width: '100%' }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>{featuredEvent.title}</h1>
            <p style={{ margin: '4px 0', opacity: 0.8 }}>{featuredEvent.venue_name}</p>
            <Link href={`/events/${featuredEvent.slug}`} style={{ color: '#fff', textDecoration: 'underline' }}>View Event</Link>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1rem' }}>
        <h2 style={{ marginBottom: 16 }}>Events Coming Up</h2>
        <EventList events={remainingEvents} />
      </div>
    </div>
  );
}

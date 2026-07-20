import { sql } from '@/lib/db';
import EventList from '@/components/EventList';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const events = await sql`
    SELECT
      e.id, e.title, e.slug, e.venue_name, e.start_at, e.end_at, e.status, e.cover_image_url, e.category,
      COALESCE(SUM(tt.quantity_total), 0) as total_capacity,
      COALESCE(SUM(tt.quantity_sold), 0) as total_sold
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.status IN ('published', 'completed')
    GROUP BY e.id
    ORDER BY e.start_at ASC
  `;

  const now = new Date();

  // Classify events based on end date, start date, or completion status
  const upcomingEvents = events.filter(e => {
    if (e.status === 'completed') return false;
    const endDate = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
    return endDate >= now;
  });

  const pastEvents = events.filter(e => {
    if (e.status === 'completed') return true;
    const endDate = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
    return endDate < now;
  });

  const featuredEvent = upcomingEvents[0];
  const remainingUpcoming = upcomingEvents.slice(1);

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff', paddingBottom: '2rem' }}>
      {/* Featured Banner */}
      {featuredEvent && (
        <div style={{ position: 'relative', width: '100%', height: 420, marginBottom: 32, borderBottom: '1px solid #1f1f1f' }}>
          <img src={featuredEvent.cover_image_url} alt={featuredEvent.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: 0, padding: '24px 32px', background: 'linear-gradient(transparent, rgba(0,0,0,0.95))', width: '100%' }}>
            <h1 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ margin: 0, fontSize: 32, marginBottom: 4 }}>{featuredEvent.title}</h1>
            <p style={{ margin: '4px 0 12px 0', color: '#d1d5db', fontSize: 15, fontWeight: 500 }}>{featuredEvent.venue_name || 'Venue TBD'}</p>
            <Link href={`/events/${featuredEvent.slug}`} className="text-indigo-400 hover:text-cyan-400 font-bold" style={{ textDecoration: 'none', fontSize: 14 }}>
              View Event &rarr;
            </Link>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1rem' }}>
        <h2 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ marginBottom: 20, fontSize: 22 }}>Events Coming Up</h2>
        {remainingUpcoming.length > 0 ? (
          <EventList events={remainingUpcoming} showFilters={true} />
        ) : (
          <p style={{ color: '#888', marginBottom: 32 }}>No upcoming events right now.</p>
        )}

        {pastEvents.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ marginBottom: 16, color: '#666', fontSize: 20, fontWeight: 700 }}>Past Events</h2>
            <EventList events={pastEvents} showFilters={false} />
          </div>
        )}
      </div>
    </div>
  );
}
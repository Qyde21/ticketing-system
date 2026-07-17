import { sql } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // 1. Fetch events and their associated ticket capacities
  const events = await sql`
    SELECT 
      e.id, 
      e.title, 
      e.slug, 
      e.venue_name, 
      e.start_at, 
      e.cover_image_url,
      COALESCE(SUM(tt.quantity_total), 0) as total_capacity,
      COALESCE(SUM(tt.quantity_sold), 0) as total_sold
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.status = 'published'
    GROUP BY e.id
    ORDER BY e.start_at ASC
  `;

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        {/* Search and Categories */}
        <div style={{ marginBottom: 24 }}>
          <input type="text" placeholder="Search events, venues..." style={{ width: "100%", padding: "12px", borderRadius: 8, background: "#1f1f1f", border: "1px solid #333", color: "#fff", marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
            {["All", "Concert", "Festival", "Comedy", "Autoshow", "Sports", "Other"].map(cat => (
              <button key={cat} style={{ padding: "8px 16px", borderRadius: 20, background: "#1f1f1f", border: "1px solid #333", color: "#fff", whiteSpace: "nowrap" }}>{cat}</button>
            ))}
          </div>
        </div>
        <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 16 }}>
          Events Coming Up
        </h2>

        {/* Grid Container */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {events.map((e: any) => {
            const eventDate = new Date(e.start_at);
            const isPastEvent = eventDate < new Date();
            
            // Safe capacity calculations
            const totalCapacity = Number(e.total_capacity) || 0;
            const totalSold = Number(e.total_sold) || 0;
            
            // If total capacity is 0, we treat it as infinite/unconfigured (not sold out)
            const isSoldOut = totalCapacity > 0 && totalSold >= totalCapacity;

            return (
              <div 
                key={e.id} 
                style={{ 
                  background: '#121212', 
                  borderRadius: 12, 
                  overflow: 'hidden', 
                  border: '1px solid #1f1f1f',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative'
                }}
              >
                {/* Event Image & Badges */}
                <div style={{ position: 'relative', width: '100%', height: 180 }}>
                  {e.cover_image_url ? (
                    <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
                      No Image
                    </div>
                  )}

                  {/* Date Badge (Top Left) */}
                  <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0, 0, 0, 0.75)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    {eventDate.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>

                  {/* Status Badges (Top Right) */}
                  {isPastEvent ? (
                    <div style={{ position: 'absolute', top: 10, right: 10, background: '#4b5563', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      Ended
                    </div>
                  ) : isSoldOut ? (
                    <div style={{ position: 'absolute', top: 10, right: 10, background: '#dc2626', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      Sold Out
                    </div>
                  ) : null}
                </div>

                {/* Event Content */}
                <div style={{ padding: 16, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#fff', lineBreak: 'anywhere' }}>
                      {e.title}
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#9ca3af' }}>
                      {e.venue_name || 'Venue TBA'}
                    </p>
                  </div>

                  {/* Card Action Block */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <div>
                      {/* Sub-text under pricing */}
                      <span style={{ fontSize: 11, color: '#9ca3af', display: 'block', textTransform: 'uppercase' }}>Price</span>
                      <strong style={{ fontSize: 15, color: '#fff' }}>
                        {isPastEvent ? 'Unavailable' : 'Tickets Available'}
                      </strong>
                    </div>

                    {isPastEvent ? (
                      <button 
                        disabled 
                        style={{ 
                          background: '#1f1f1f', 
                          color: '#4b5563', 
                          border: 'none', 
                          padding: '8px 16px', 
                          borderRadius: 20, 
                          fontSize: 13, 
                          fontWeight: 600, 
                          cursor: 'not-allowed' 
                        }}
                      >
                        Ended
                      </button>
                    ) : isSoldOut ? (
                      <button 
                        disabled 
                        style={{ 
                          background: '#1f1f1f', 
                          color: '#dc2626', 
                          border: 'none', 
                          padding: '8px 16px', 
                          borderRadius: 20, 
                          fontSize: 13, 
                          fontWeight: 600, 
                          cursor: 'not-allowed' 
                        }}
                      >
                        Sold out
                      </button>
                    ) : (
                      <Link 
                        href={`/events/${e.slug}`}
                        style={{ 
                          background: '#fff', 
                          color: '#000', 
                          textDecoration: 'none', 
                          padding: '8px 16px', 
                          borderRadius: 20, 
                          fontSize: 13, 
                          fontWeight: 600,
                          textAlign: 'center'
                        }}
                      >
                        Get tickets
                      </Link>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

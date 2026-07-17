import { sql } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizerEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: organizerId } = await params;

  // Fetch organizer details
  const [organizer] = await sql`
    SELECT full_name, email FROM users WHERE id = ${organizerId} AND role = 'organizer'
  `;

  if (!organizer) {
    return <div style={{ margin: '2rem', color: '#fff' }}>Organizer not found.</div>;
  }

  // Fetch events for this specific organizer
  const events = await sql`
    SELECT id, title, status, start_at, cover_image_url
    FROM events
    WHERE organizer_id = ${organizerId}
    ORDER BY created_at DESC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin/organizers" style={{ color: '#6366f1', textDecoration: 'none', fontSize: 14 }}>
          ← Back to Organizers
        </Link>
      </div>

      <h1 style={{ color: '#fff', margin: '0 0 4px 0' }}>Events by {organizer.full_name}</h1>
      <p style={{ color: '#9ca3af', margin: '0 0 24px 0', fontSize: 14 }}>{organizer.email}</p>

      {events.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>No events found for this organizer.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {events.map((e: any) => (
            <li 
              key={e.id} 
              style={{ 
                display: 'flex', 
                gap: 16, 
                marginBottom: 16, 
                alignItems: 'center', 
                background: '#fff', 
                borderRadius: 8, 
                padding: 12, 
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)' 
              }}
            >
              {/* Thumbnail */}
              <div style={{ width: 80, height: 60, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {e.cover_image_url ? (
                  <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#fff', fontSize: 10, textAlign: 'center', padding: 4 }}>{e.title}</span>
                )}
              </div>

              {/* Event Info & Action Buttons */}
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#111827' }}>{e.title}</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                  {e.status} — {new Date(e.start_at).toLocaleDateString()}
                </div>

                {/* Dashboard Action Links mimicking the working Organizer structure */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 13 }}>
                  {e.status === 'published' && (
                    <>
                      <Link href={`/scan/${e.id}`} style={{ color: '#6366f1', textDecoration: 'none' }}>Scan tickets</Link>
                      <Link href={`/organizer/events/${e.id}/scan-overview`} style={{ color: '#6366f1', textDecoration: 'none' }}>Scan overview</Link>
                    </>
                  )}
                  <Link href={`/organizer/events/${e.id}/orders`} style={{ color: '#6366f1', textDecoration: 'none' }}>Orders</Link>
                  <Link href={`/organizer/events/${e.id}/messages`} style={{ color: '#6366f1', textDecoration: 'none' }}>Messages</Link>
                  <Link href={`/organizer/events/${e.id}/edit`} style={{ color: '#6366f1', textDecoration: 'none' }}>Edit cover</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

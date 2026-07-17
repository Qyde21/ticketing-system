import { sql } from '@/lib/db';
import Link from 'next/link';
import AdminEventActions from './AdminEventActions';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const events = await sql`
    SELECT e.id, e.title, e.status, e.start_at, e.cover_image_url,
           u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    ORDER BY e.created_at DESC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>All Events</h1>
      <Link href="/admin/events/new" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
        + Create new event
      </Link>
      
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {events.map((e: any) => (
          <li key={e.id} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            
            {/* Thumbnail */}
            <div style={{ width: 80, height: 60, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {e.cover_image_url ? (
                <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#fff', fontSize: 10, textAlign: 'center', padding: 4 }}>{e.title}</span>
              )}
            </div>

            {/* Event Info & Corrected Actions */}
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#111827' }}>{e.title}</strong>
              <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                Status: <span style={{ fontWeight: 600, color: '#111827' }}>{e.status}</span> — {new Date(e.start_at).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>
                Organizer: {e.organizer_name} ({e.organizer_email})
              </div>

              {/* Action Links mimicking the working Organizer structure */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 13 }}>
                {/* ADMIN OVERRIDE: Show scanner links to admins even if status is draft/pending to prevent 404s */}
                <Link href={`/scan/${e.id}`} style={{ color: '#6366f1', textDecoration: 'none' }}>Scan tickets</Link>
                <Link href={`/organizer/events/${e.id}/scan-overview`} style={{ color: '#6366f1', textDecoration: 'none' }}>Scan overview</Link>
                
                <Link href={`/organizer/events/${e.id}/orders`} style={{ color: '#6366f1', textDecoration: 'none' }}>Orders</Link>
                <Link href={`/organizer/events/${e.id}/messages`} style={{ color: '#6366f1', textDecoration: 'none' }}>Messages</Link>
                <Link href={`/organizer/events/${e.id}/edit`} style={{ color: '#6366f1', textDecoration: 'none' }}>Edit cover</Link>
                
                {/* Admin Status Controls (Approve/Reject/Cancel) */}
                <AdminEventActions eventId={e.id} status={e.status} />
              </div>
            </div>

          </li>
        ))}
      </ul>
    </div>
  );
}

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
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>All Events</h1>
      <p style={{ color: '#666' }}>{events.length} event(s) total</p>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {events.map((e: any) => (
          <li key={e.id} style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            {/* Thumbnail */}
            <div style={{ width: 70, height: 52, borderRadius: 6, overflow: 'hidden', background: '#6366f1', flexShrink: 0 }}>
              {e.cover_image_url ? (
                <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <strong>{e.title}</strong>
              <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                {e.organizer_name} ({e.organizer_email})
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                {e.status} — {new Date(e.start_at).toLocaleDateString()}
              </div>
              {e.status === 'published' && (
                <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                  <Link href={`/scan/${e.id}`} style={{ fontSize: 12, color: '#6366f1' }}>
                    Scan tickets
                  </Link>
                  <Link href={`/admin/scan/${e.id}`} style={{ fontSize: 12, color: '#6366f1' }}>
                    Scan overview
                  </Link>
                </div>
              )}
            </div>

            {/* Actions */}
            <AdminEventActions eventId={e.id} status={e.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

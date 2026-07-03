import { sql } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OrganizerEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [organizer] = await sql`
    SELECT u.full_name, u.email, op.business_name
    FROM users u
    JOIN organizer_profiles op ON op.user_id = u.id
    WHERE u.id = ${id}
  `;

  const events = await sql`
    SELECT id, title, status, start_at, cover_image_url
    FROM events WHERE organizer_id = ${id}
    ORDER BY created_at DESC
  `;

  if (!organizer) {
    return <div style={{ margin: '2rem' }}>Organizer not found.</div>;
  }

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <Link href="/admin/organizers" style={{ fontSize: 13, color: '#6366f1' }}>Back to organizers</Link>
      <h1 style={{ marginTop: 8 }}>{organizer.business_name}</h1>
      <p style={{ color: '#666' }}>{organizer.full_name} — {organizer.email}</p>

      <h2>Events ({events.length})</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map((e: any) => (
          <li key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ width: 60, height: 45, borderRadius: 4, overflow: 'hidden', background: '#6366f1', flexShrink: 0 }}>
              {e.cover_image_url ? (
                <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
            </div>
            <div>
              <strong>{e.title}</strong>
              <div style={{ fontSize: 13, color: '#666' }}>
                {e.status} — {new Date(e.start_at).toLocaleDateString()}
              </div>
            </div>
          </li>
        ))}
        {events.length === 0 && <p style={{ color: '#666' }}>No events yet.</p>}
      </ul>
    </div>
  );
}

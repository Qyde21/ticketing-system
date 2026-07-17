import { sql } from '@/lib/db';
import Link from 'next/link';
import OrganizerActions from './OrganizerActions';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizersPage() {
  const organizers = await sql`
    SELECT u.id, u.full_name, u.email, u.created_at,
           op.business_name, op.is_verified,
           COUNT(e.id) AS total_events,
           COUNT(CASE WHEN e.status = 'published' THEN 1 END) AS published_events
    FROM users u
    JOIN organizer_profiles op ON op.user_id = u.id
    LEFT JOIN events e ON e.organizer_id = u.id
    WHERE u.role = 'organizer'
    GROUP BY u.id, u.full_name, u.email, u.created_at, op.business_name, op.is_verified
    ORDER BY u.created_at DESC
  `;

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Organizer Management</h1>
      <p style={{ color: '#4b5563' }}>{organizers.length} organizer(s) total</p>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {organizers.map((o: any) => (
          <li key={o.id} style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong style={{ color: '#111827', fontSize: 16 }}>{o.business_name}</strong>
                <div style={{ fontSize: 14, color: '#374151', marginTop: 4 }}>
                  {o.full_name} — {o.email}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  Joined: {new Date(o.created_at).toLocaleDateString()} | 
                  Events: {o.total_events} ({o.published_events} published)
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 600,
                    background: o.is_verified ? '#d4edda' : '#fff3cd',
                    color: o.is_verified ? '#155724' : '#856404'
                  }}>
                    {o.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href={`/admin/organizers/${o.id}/events`} style={{ fontSize: 14, color: '#4f46e5', fontWeight: 600 }}>
                  View events
                </Link>
                <OrganizerActions
                  userId={o.id}
                  isVerified={o.is_verified}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

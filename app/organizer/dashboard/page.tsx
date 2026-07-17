import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PublishButton from '../PublishButton';
import CancelEventButton from '../CancelEventButton';

export const dynamic = 'force-dynamic';

export default async function OrganizerDashboard() {
  const session = await getSession();
  const events = await sql`
    SELECT id, title, slug, status, start_at, cover_image_url
    FROM events
    WHERE organizer_id = ${session!.userId}
    AND status != 'cancelled'
    ORDER BY created_at DESC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Your Events</h1>
      <Link href="/organizer/events/new" style={{ color: '#6366f1', fontWeight: 600 }}>+ Create new event</Link>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {events.map((e: any) => (
          <li key={e.id} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ width: 80, height: 60, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {e.cover_image_url ? (
                <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#fff', fontSize: 10, textAlign: 'center', padding: 4 }}>{e.title}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#111827', fontSize: 15 }}>{e.title}</strong>
              <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>
                {e.status.toUpperCase()} — {new Date(e.start_at).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
                {e.status === 'draft' && <PublishButton eventId={e.id} />}
                {e.status === 'published' && (
                  <>
                    <Link href={`/scan/${e.id}`} style={{ color: '#4f46e5', fontWeight: 500 }}>Scan tickets</Link>
                    <Link href={`/organizer/events/${e.id}/scan-overview`} style={{ color: '#4f46e5', fontWeight: 500 }}>Scan overview</Link>
                  </>
                )}
                <Link href={`/organizer/events/${e.id}/orders`} style={{ color: '#4f46e5', fontWeight: 500 }}>Orders</Link>
                <Link href={`/organizer/events/${e.id}/messages`} style={{ color: '#4f46e5', fontWeight: 500 }}>Messages</Link>
                <Link href={`/organizer/events/${e.id}/edit`} style={{ color: '#4f46e5', fontWeight: 500 }}>Edit cover</Link>
                {(e.status === 'draft' || e.status === 'published') && (
                  <CancelEventButton eventId={e.id} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

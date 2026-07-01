import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PublishButton from '../PublishButton';
import CancelEventButton from '../CancelEventButton';

export const dynamic = 'force-dynamic';

export default async function OrganizerDashboard() {
  const session = await getSession();
  const events = await sql`
    SELECT id, title, slug, status, start_at
    FROM events
    WHERE organizer_id = ${session!.userId}
    AND status != 'cancelled'
    ORDER BY created_at DESC
  `;

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto' }}>
      <h1>Your Events</h1>
      <Link href="/organizer/events/new">+ Create new event</Link>
      <ul>
        {events.map((e: any) => (
          <li key={e.id} style={{ marginBottom: 8 }}>
            {e.title} - {e.status} - {new Date(e.start_at).toLocaleString()}
            {e.status === 'draft' && <PublishButton eventId={e.id} />}
            {e.status === 'published' && <Link href={`/scan/${e.id}`}> Scan tickets</Link>}
            {(e.status === 'draft' || e.status === 'published') && (
              <>
                {' | '}
                <Link href={`/organizer/events/${e.id}/orders`}>Orders</Link>
                <CancelEventButton eventId={e.id} />
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

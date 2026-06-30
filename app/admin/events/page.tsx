import { sql } from '@/lib/db';

export default async function AdminEventsPage() {
  const events = await sql`
    SELECT e.id, e.title, e.status, e.start_at, u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    ORDER BY e.created_at DESC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto' }}>
      <h1>All Events</h1>
      <ul>
        {events.map((e: any) => (
          <li key={e.id} style={{ marginBottom: 8 }}>
            {e.title} — {e.status} — by {e.organizer_name} ({e.organizer_email}) — {new Date(e.start_at).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
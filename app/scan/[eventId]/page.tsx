import { sql } from '@/lib/db';
import Scanner from './Scanner';

export const dynamic = 'force-dynamic';

export default async function ScanPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [event] = await sql`SELECT id, title FROM events WHERE id = ${eventId}`;

  if (!event) {
    return <div style={{ margin: '2rem' }}>Event not found.</div>;
  }

  const [counts] = await sql`
    SELECT
      COUNT(t.id) AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'used') AS checked_in,
      COUNT(t.id) FILTER (WHERE t.status = 'valid') AS remaining
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE tt.event_id = ${eventId}
  `;

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Check-in: {event.title}</h1>

      {/* Live counter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{counts.checked_in}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Checked in</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{counts.remaining}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Not yet in</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#6366f1' }}>{counts.total}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Total</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ width: (Number(counts.total) > 0 ? Math.round((Number(counts.checked_in) / Number(counts.total)) * 100) : 0) + '%', background: '#16a34a', height: '100%', transition: 'width 0.3s' }} />
      </div>

      <Scanner eventId={event.id} initialCheckedIn={Number(counts.checked_in)} initialTotal={Number(counts.total)} />
    </div>
  );
}
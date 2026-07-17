import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrganizerScanOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  
  // 1. Retrieve the session using your project's native auth helper
  const session = await getSession();
  if (!session || !session.userId) {
    redirect('/login');
  }

  const userId = session.userId;

  // 2. Verify that this event belongs to the logged-in organizer
  const [event] = await sql`
    SELECT id, title, venue_name, start_at, organizer_id 
    FROM events 
    WHERE id = ${eventId} AND organizer_id = ${userId}
  `;

  if (!event) {
    return (
      <div style={{ margin: '2rem', textAlign: 'center', color: '#dc2626' }}>
        <strong>Access Denied:</strong> Event not found or you do not have permission to view this scan overview.
      </div>
    );
  }

  // 3. Fetch the ticket data
  const tickets = await sql`
    SELECT t.ticket_code, t.status, t.holder_name, t.checked_in_at,
           tt.name AS ticket_type
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN orders o ON o.id = t.order_id
    WHERE o.event_id = ${eventId}
    ORDER BY t.checked_in_at DESC NULLS LAST
  `;

  const total = tickets.length;
  const checkedIn = tickets.filter((t: any) => t.status === 'used').length;
  const valid = tickets.filter((t: any) => t.status === 'valid').length;
  const cancelled = tickets.filter((t: any) => t.status === 'cancelled').length;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <Link href={`/organizer/dashboard`} style={{ fontSize: 13, color: '#6366f1' }}>
        ← Back to dashboard
      </Link>
      <h1 style={{ marginTop: 8 }}>{event.title}</h1>
      <p style={{ color: '#666' }}>{event.venue_name} — {new Date(event.start_at).toLocaleString()}</p>

      {/* Stats Grid */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total tickets', value: total, color: '#6366f1' },
          { label: 'Checked in', value: checkedIn, color: '#16a34a' },
          { label: 'Not yet in', value: valid, color: '#d97706' },
          { label: 'Cancelled', value: cancelled, color: '#dc2626' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: 8, padding: '12px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div style={{ marginTop: 16, background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${total > 0 ? (checkedIn / total) * 100 : 0}%`, background: '#16a34a', height: '100%', transition: 'width 0.3s' }} />
      </div>
      <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
        {total > 0 ? Math.round((checkedIn / total) * 100) : 0}% checked in
      </p>

      <Link
        href={`/scan/${eventId}`}
        style={{ display: 'inline-block', marginTop: 12, background: '#6366f1', color: '#fff', padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
      >
        Open Scanner
      </Link>

      <h2 style={{ marginTop: 24 }}>Tickets</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tickets.map((t: any) => (
          <li key={t.ticket_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginBottom: 8, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div>
              <strong style={{ fontSize: 13 }}>{t.ticket_code}</strong>
              <div style={{ fontSize: 12, color: '#666' }}>{t.holder_name} — {t.ticket_type}</div>
              {t.checked_in_at && (
                <div style={{ fontSize: 12, color: '#16a34a' }}>
                  Checked in: {new Date(t.checked_in_at).toLocaleTimeString()}
                </div>
              )}
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 99,
              background: t.status === 'used' ? '#d4edda' : t.status === 'cancelled' ? '#f8d7da' : '#fff3cd',
              color: t.status === 'used' ? '#155724' : t.status === 'cancelled' ? '#721c24' : '#856404'
            }}>
              {t.status === 'used' ? 'Checked in' : t.status === 'cancelled' ? 'Cancelled' : 'Valid'}
            </span>
          </li>
        ))}
        {tickets.length === 0 && <p style={{ color: '#666' }}>No tickets sold yet.</p>}
      </ul>
    </div>
  );
}

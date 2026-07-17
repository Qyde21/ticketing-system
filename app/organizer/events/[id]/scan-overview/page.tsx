import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Force Next.js to skip build-time static generation and run this fresh on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizerScanOverviewPage({ params }: PageProps) {
  // Await the routing parameters
  const resolvedParams = await params;
  const eventId = resolvedParams.id;

  // Retrieve current user session
  const session = await getSession();
  
  // Debug logging on Vercel Server console
  console.log("--- SCAN OVERVIEW ROUTE ACCESS ---");
  console.log("Event ID:", eventId);
  console.log("Session details:", session);

  if (!session || !session.userId) {
    redirect('/login');
  }

  const userId = session.userId;
  const userRole = session.role;

  let event = null;

  try {
    if (userRole === 'admin') {
      // Admin bypass: load event regardless of status or who owns it
      const results = await sql`
        SELECT id, title, venue_name, start_at, organizer_id
        FROM events
        WHERE id = ${eventId}
      `;
      if (results && results.length > 0) {
        event = results[0];
      }
    } else {
      // Organizer security check: must be the owner
      const results = await sql`
        SELECT id, title, venue_name, start_at, organizer_id
        FROM events
        WHERE id = ${eventId} AND organizer_id = ${userId}
      `;
      if (results && results.length > 0) {
        event = results[0];
      }
    }
  } catch (error) {
    console.error("Database query failed:", error);
  }

  // If still no event found, print descriptive error with role info
  if (!event) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#991b1b', fontSize: 20, marginTop: 0 }}>Access Denied (Debug Panel)</h1>
        <p style={{ color: '#7f1d1d', fontSize: 14 }}>
          We couldn't load the event or authorize this request.
        </p>
        <div style={{ background: '#fff', padding: 12, borderRadius: 6, marginTop: 12, fontSize: 13, border: '1px solid #f3f4f6' }}>
          <strong>Your Active Session:</strong>
          <pre style={{ margin: '8px 0 0 0', color: '#4b5563' }}>{JSON.stringify({ userId, userRole, eventId }, null, 2)}</pre>
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/admin/events" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            ← Return to Event List
          </Link>
        </div>
      </div>
    );
  }

  // Fetch ticket data
  const tickets = await sql`
    SELECT t.ticket_code, t.status, t.holder_name, t.checked_in_at,
           tt.name AS ticket_type
    FROM tickets t
    LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
    LEFT JOIN orders o ON o.id = t.order_id
    WHERE o.event_id = ${eventId}
    ORDER BY t.checked_in_at DESC NULLS LAST
  `;

  const total = tickets.length;
  const checkedIn = tickets.filter((t: any) => t.status === 'used').length;
  const valid = tickets.filter((t: any) => t.status === 'valid').length;
  const cancelled = tickets.filter((t: any) => t.status === 'cancelled').length;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      <Link href={userRole === 'admin' ? `/admin/organizers/${event.organizer_id}/events` : `/organizer/dashboard`} style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none' }}>
        ← Back to {userRole === 'admin' ? 'events list' : 'dashboard'}
      </Link>
      <h1 style={{ marginTop: 8, color: '#111827' }}>{event.title}</h1>
      <p style={{ color: '#666' }}>{event.venue_name || 'No Venue Specified'} — {event.start_at ? new Date(event.start_at).toLocaleString() : 'No Date'}</p>

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
        style={{ display: 'inline-block', marginTop: 12, background: '#6366f1', color: '#fff', padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
      >
        Open Scanner
      </Link>

      <h2 style={{ marginTop: 24, color: '#111827' }}>Tickets</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tickets.map((t: any) => (
          <li key={t.ticket_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginBottom: 8, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div>
              <strong style={{ fontSize: 13, color: '#111827' }}>{t.ticket_code}</strong>
              <div style={{ fontSize: 12, color: '#666' }}>{t.holder_name || 'Anonymous'} — {t.ticket_type || 'Standard'}</div>
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

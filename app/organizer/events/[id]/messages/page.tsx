import { sql } from '@/lib/db';
import Link from 'next/link';
import MessageComposer from './MessageComposer';

export const dynamic = 'force-dynamic';

export default async function OrganizerMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [event] = await sql`SELECT id, title FROM events WHERE id = ${id}`;
  if (!event) return <div style={{ margin: '2rem' }}>Event not found.</div>;

  const buyers = await sql`
    SELECT DISTINCT u.id, u.full_name, u.email
    FROM orders o
    JOIN users u ON u.email = o.buyer_email
    WHERE o.event_id = ${id} AND o.payment_status = 'paid'
    ORDER BY u.full_name ASC
  `;

  const messages = await sql`
    SELECT m.id, m.body, m.is_broadcast, m.created_at,
           u.full_name AS sender_name, u.id AS sender_id,
           r.full_name AS recipient_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN users r ON r.id = m.recipient_id
    WHERE m.event_id = ${id}
    ORDER BY m.created_at DESC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <Link href="/organizer/dashboard" style={{ fontSize: 13, color: '#6366f1' }}>Back to dashboard</Link>
      <h1 style={{ marginTop: 8 }}>Messages — {event.title}</h1>
      <p style={{ color: '#666', fontSize: 14 }}>{buyers.length} ticket buyer(s)</p>

      <MessageComposer eventId={event.id} buyers={buyers as any} />

      <h2 style={{ marginTop: 32 }}>Message History</h2>
      {messages.length === 0 && <p style={{ color: '#666' }}>No messages yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m: any) => (
          <li key={m.id} style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{m.sender_name}</span>
              <span style={{ fontSize: 12, color: '#999' }}>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            {m.is_broadcast && (
              <span style={{ fontSize: 11, background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 99, fontWeight: 600, marginBottom: 6, display: 'inline-block' }}>
                Broadcast
              </span>
            )}
            {!m.is_broadcast && m.recipient_name && (
              <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 99, marginBottom: 6, display: 'inline-block' }}>
                To: {m.recipient_name}
              </span>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{m.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
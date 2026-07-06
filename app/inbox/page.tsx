import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import InboxReply from './InboxReply';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await getSession();
  if (!session) {
    return <div style={{ margin: '2rem' }}>Please log in to view your inbox.</div>;
  }

  const messages = await sql`
    SELECT m.id, m.body, m.is_broadcast, m.created_at, m.event_id,
           u.full_name AS sender_name, u.id AS sender_id,
           e.title AS event_title
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    JOIN events e ON e.id = m.event_id
    WHERE m.recipient_id = ${session.userId}
    ORDER BY m.created_at DESC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Your Inbox</h1>
      <p style={{ color: '#666' }}>{messages.length} message(s)</p>

      {messages.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 32, textAlign: 'center', color: '#666', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          No messages yet. Messages from event organizers will appear here.
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m: any) => (
          <li key={m.id} style={{ background: '#fff', borderRadius: 8, padding: 20, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{m.event_title}</span>
              <span style={{ fontSize: 12, color: '#999' }}>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>From: {m.sender_name}</div>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{m.body}</p>
            <InboxReply eventId={m.event_id} recipientId={m.sender_id} senderName={m.sender_name} />
          </li>
        ))}
      </ul>
    </div>
  );
}
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import InboxReply from './InboxReply';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await getSession();
  if (!session) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Please log in to view your inbox.</div>;
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
    <div className="max-w-2xl mx-auto py-12 px-4 text-white">
      <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Your Inbox</h1>
      <p className="text-gray-400 text-sm mt-1 mb-8">{messages.length} message(s)</p>

      {messages.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
          No messages yet. Messages from event organizers will appear here.
        </div>
      )}

      <ul className="space-y-3">
        {messages.map((m: any) => (
          <li key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-bold text-indigo-400">{m.event_title}</span>
              <span className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-400 mb-2">From: {m.sender_name}</div>
            <p className="text-sm text-gray-200 leading-relaxed mb-3">{m.body}</p>
            <InboxReply eventId={m.event_id} recipientId={m.sender_id} senderName={m.sender_name} />
          </li>
        ))}
      </ul>
    </div>
  );
}

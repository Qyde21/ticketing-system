import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import InboxMessageList from './InboxMessageList';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await getSession();
  if (!session) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-black">Please log in to view your inbox.</div>;
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
    <div className="max-w-2xl mx-auto py-12 px-4 text-black">
      <h1 className="text-3xl font-extrabold text-black">Your Inbox</h1>
      <InboxMessageList initialMessages={messages as any} />
    </div>
  );
}

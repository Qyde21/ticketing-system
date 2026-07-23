import { sql } from '@/lib/db';
import Link from 'next/link';
import MessageComposer from './MessageComposer';

export const dynamic = 'force-dynamic';

export default async function OrganizerMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [event] = await sql`SELECT id, title FROM events WHERE id = ${id}`;
  if (!event) return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Event not found.</div>;

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
    <div className="max-w-2xl mx-auto py-12 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:text-cyan-400">Back to dashboard</Link>
      <h1 className="text-3xl font-extrabold mt-2 mb-1">Messages — {event.title}</h1>
      <p className="text-gray-400 text-sm mb-8">{buyers.length} ticket buyer(s)</p>

      <MessageComposer eventId={event.id} buyers={buyers as any} />

      <h2 className="text-xl font-bold text-white mt-10 mb-4">Message History</h2>
      {messages.length === 0 && <p className="text-gray-400">No messages yet.</p>}
      <ul className="space-y-3">
        {messages.map((m: any) => (
          <li key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-bold text-white">{m.sender_name}</span>
              <span className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</span>
            </div>
            {m.is_broadcast && (
              <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-semibold mb-1.5 inline-block">
                Broadcast
              </span>
            )}
            {!m.is_broadcast && m.recipient_name && (
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full mb-1.5 inline-block">
                To: {m.recipient_name}
              </span>
            )}
            <p className="text-sm text-gray-300 leading-relaxed mt-1.5">{m.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

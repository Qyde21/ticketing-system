'use client';
import { useEffect, useRef, useState } from 'react';
import InboxReply from './InboxReply';

interface Message {
  id: string;
  body: string;
  is_broadcast: boolean;
  created_at: string;
  event_id: string;
  sender_name: string;
  sender_id: string;
  event_title: string;
}

const POLL_INTERVAL_MS = 8000;

export default function InboxMessageList({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [hasNew, setHasNew] = useState(false);
  const knownIds = useRef(new Set(initialMessages.map((m) => m.id)));

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/messages');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.messages)) return;

        const incomingIds = new Set(data.messages.map((m: Message) => m.id));
        const isNew = [...incomingIds].some((id) => !knownIds.current.has(id));

        knownIds.current = incomingIds;
        setMessages(data.messages);
        if (isNew) setHasNew(true);
      } catch {
        // silent - next poll will retry
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <p className="text-gray-400 text-sm mt-1 mb-8">
        {messages.length} message(s)
        {hasNew && (
          <span className="ml-2 text-emerald-400 font-semibold">· New message received</span>
        )}
      </p>

      {messages.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
          No messages yet. Messages from event organizers will appear here.
        </div>
      )}

      <ul className="space-y-3">
        {messages.map((m) => (
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

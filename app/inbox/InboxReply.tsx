'use client';
import { useState } from 'react';

export default function InboxReply({ eventId, recipientId, senderName }: { eventId: string; recipientId: string; senderName: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleReply() {
    if (!body.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, recipientId, body, isBroadcast: false }),
    });

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setBody('');
      setOpen(false);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to send reply');
    }
  }

  if (success) return <p className="text-sm text-emerald-400">Reply sent to {senderName}!</p>;

  return (
    <div>
      {!open && (
        <button onClick={() => setOpen(true)} className="text-sm text-indigo-400 hover:text-cyan-400 bg-transparent border-none cursor-pointer p-0">
          Reply to {senderName}
        </button>
      )}
      {open && (
        <div className="mt-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Reply to ${senderName}...`}
            rows={3}
            className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm resize-y focus:outline-none focus:border-indigo-500 placeholder:text-neutral-500"
          />
          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleReply}
              disabled={loading || !body.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reply'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-4 py-2 rounded-lg text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

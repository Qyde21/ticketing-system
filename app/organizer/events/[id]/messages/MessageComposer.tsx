'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Buyer {
  id: string;
  full_name: string;
  email: string;
}

export default function MessageComposer({ eventId, buyers }: { eventId: string; buyers: Buyer[] }) {
  const router = useRouter();
  const [isBroadcast, setIsBroadcast] = useState(true);
  const [recipientId, setRecipientId] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSend() {
    if (!body.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, recipientId: isBroadcast ? null : recipientId, body, isBroadcast }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setBody('');
      setSuccess(isBroadcast ? `Message sent to ${data.sent} buyer(s)` : 'Message sent successfully');
      router.refresh();
    } else {
      setError(data.error || 'Failed to send message');
    }
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5">
      <h2 className="text-lg font-bold text-black mb-4">Send Message</h2>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setIsBroadcast(true)}
          className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition ${
            isBroadcast ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          Broadcast to all buyers
        </button>
        <button
          onClick={() => setIsBroadcast(false)}
          className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition ${
            !isBroadcast ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          Direct message
        </button>
      </div>

      {!isBroadcast && (
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="w-full bg-neutral-50 border border-black/10 rounded-lg p-2.5 text-black text-sm mb-3 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Select a buyer...</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>{b.full_name} ({b.email})</option>
          ))}
        </select>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isBroadcast ? 'Write a message to all ticket buyers...' : 'Write a direct message...'}
        rows={4}
        className="w-full bg-neutral-50 border border-black/10 rounded-lg p-3 text-black text-sm resize-y focus:outline-none focus:border-indigo-500 placeholder:text-neutral-500"
      />

      {error && <p className="text-red-600 text-sm my-2">{error}</p>}
      {success && <p className="text-emerald-600 text-sm my-2">{success}</p>}

      <button
        onClick={handleSend}
        disabled={loading || !body.trim() || (!isBroadcast && !recipientId)}
        className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Message'}
      </button>
    </div>
  );
}

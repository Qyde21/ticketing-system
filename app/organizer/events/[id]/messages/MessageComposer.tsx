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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-4">
      <h2 className="text-lg font-bold text-white mb-4">Send Message</h2>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setIsBroadcast(true)}
          className={
            'px-4 py-1.5 rounded-lg font-semibold text-sm transition ' +
            (isBroadcast ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')
          }
        >
          Broadcast to all buyers
        </button>
        <button
          onClick={() => setIsBroadcast(false)}
          className={
            'px-4 py-1.5 rounded-lg font-semibold text-sm transition ' +
            (!isBroadcast ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')
          }
        >
          Direct message
        </button>
      </div>

      {!isBroadcast && (
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-indigo-500"
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
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        style={{ resize: 'vertical', boxSizing: 'border-box' }}
      />

      {error && <p className="text-red-400 text-sm my-2">{error}</p>}
      {success && <p className="text-green-400 text-sm my-2">{success}</p>}

      <button
        onClick={handleSend}
        disabled={loading || !body.trim() || (!isBroadcast && !recipientId)}
        className="mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition"
      >
        {loading ? 'Sending...' : 'Send Message'}
      </button>
    </div>
  );
}

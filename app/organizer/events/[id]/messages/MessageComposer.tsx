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
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginTop: 16 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Send Message</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setIsBroadcast(true)} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: isBroadcast ? '#6366f1' : '#f3f4f6', color: isBroadcast ? '#fff' : '#374151', fontWeight: 600, fontSize: 13 }}>
          Broadcast to all buyers
        </button>
        <button onClick={() => setIsBroadcast(false)} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: !isBroadcast ? '#6366f1' : '#f3f4f6', color: !isBroadcast ? '#fff' : '#374151', fontWeight: 600, fontSize: 13 }}>
          Direct message
        </button>
      </div>

      {!isBroadcast && (
        <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', marginBottom: 12, fontSize: 14 }}>
          <option value="">Select a buyer...</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>{b.full_name} ({b.email})</option>
          ))}
        </select>
      )}

      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={isBroadcast ? 'Write a message to all ticket buyers...' : 'Write a direct message...'} rows={4} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />

      {error && <p style={{ color: 'red', fontSize: 13, margin: '8px 0' }}>{error}</p>}
      {success && <p style={{ color: 'green', fontSize: 13, margin: '8px 0' }}>{success}</p>}

      <button onClick={handleSend} disabled={loading || !body.trim() || (!isBroadcast && !recipientId)} style={{ marginTop: 8, background: '#6366f1', color: '#fff', padding: '10px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
        {loading ? 'Sending...' : 'Send Message'}
      </button>
    </div>
  );
}
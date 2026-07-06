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

  if (success) return <p style={{ fontSize: 13, color: 'green' }}>Reply sent to {senderName}!</p>;

  return (
    <div>
      {!open && (
        <button onClick={() => setOpen(true)} style={{ fontSize: 13, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Reply to {senderName}
        </button>
      )}
      {open && (
        <div style={{ marginTop: 8 }}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Reply to ${senderName}...`} rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          {error && <p style={{ color: 'red', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleReply} disabled={loading || !body.trim()} style={{ background: '#6366f1', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              {loading ? 'Sending...' : 'Send Reply'}
            </button>
            <button onClick={() => setOpen(false)} style={{ background: '#f3f4f6', color: '#374151', padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
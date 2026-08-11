'use client';
import { useState } from 'react';

export default function MessageOrganizerWidget({
  eventId,
  organizerId,
  eventTitle,
}: {
  eventId: string;
  organizerId: string;
  eventTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!body.trim()) {
      setError('Please write a message first');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, recipientId: organizerId, body }),
      });
      const data = await res.json();

      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button — stacked directly above the WhatsApp support button
          (which sits at bottom:24, right:24, 56px), so this sits at bottom:92
          to avoid overlapping it. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Message the organizer"
        style={{
          position: 'fixed',
          bottom: 92,
          right: 24,
          zIndex: 1000,
          background: '#4F46E5',
          color: '#fff',
          borderRadius: '50%',
          width: 56,
          height: 56,
          display: open ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>

      {open && (
        <div
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1001 }}
          className="w-80 max-w-[calc(100vw-48px)] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600">
            <p className="text-white font-semibold text-sm truncate pr-2">Message organizer</p>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-lg leading-none">
              &times;
            </button>
          </div>

          <div className="p-4">
            {sent ? (
              <div className="text-center py-4">
                <p className="text-emerald-400 font-semibold mb-1">Message sent!</p>
                <p className="text-gray-400 text-sm">
                  The organizer will see it in their inbox and get an email. Check your{' '}
                  <a href="/inbox" className="text-indigo-400 hover:underline">TicketHub inbox</a> for their reply.
                </p>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-xs mb-3">
                  Ask a question about <span className="text-gray-300 font-medium">{eventTitle}</span> — parking, entry, anything.
                </p>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send message'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

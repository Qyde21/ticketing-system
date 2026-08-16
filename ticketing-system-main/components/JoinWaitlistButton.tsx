'use client';
import { useState } from 'react';

export default function JoinWaitlistButton({ ticketTypeId }: { ticketTypeId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketTypeId, name, email }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to join waitlist');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <span className="px-4 py-2 bg-emerald-950/50 text-emerald-300 border border-emerald-800/50 rounded-xl font-semibold text-sm text-center">
        You&apos;re on the waitlist!
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold uppercase tracking-wider transition text-sm"
      >
        Join Waitlist
      </button>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col gap-2" style={{ minWidth: 240 }}>
      <p className="text-xs font-semibold text-gray-300">Get notified if a spot opens up:</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleJoin}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
        >
          {loading ? 'Joining...' : 'Join Waitlist'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); }}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-4 py-2 rounded-lg transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

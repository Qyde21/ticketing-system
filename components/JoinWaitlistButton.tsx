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
      <span className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-semibold text-sm text-center">
        You&apos;re on the waitlist!
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-6 py-3 bg-black hover:bg-neutral-800 text-white rounded-full font-bold uppercase tracking-wider transition text-sm"
      >
        Join Waitlist
      </button>
    );
  }

  return (
    <div className="bg-white border border-black/15 rounded-xl p-4 flex flex-col gap-2" style={{ minWidth: 240 }}>
      <p className="text-xs font-semibold text-neutral-700">Get notified if a spot opens up:</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full bg-white border border-black/20 rounded-lg px-3 py-2 text-sm text-black placeholder-neutral-500 focus:outline-none focus:border-black"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="w-full bg-white border border-black/20 rounded-lg px-3 py-2 text-sm text-black placeholder-neutral-500 focus:outline-none focus:border-black"
      />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleJoin}
          disabled={loading}
          className="bg-black hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-full transition"
        >
          {loading ? 'Joining...' : 'Join Waitlist'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(''); }}
          className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs px-4 py-2 rounded-full transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

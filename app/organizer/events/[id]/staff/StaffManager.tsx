'use client';

import { useState } from 'react';

type StaffMember = { id: string; full_name: string; email: string };

export default function StaffManager({
  eventId,
  initialStaff,
}: {
  eventId: string;
  initialStaff: StaffMember[];
}) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add staff');
        return;
      }
      if (data.staff && !staff.some((s) => s.id === data.staff.id)) {
        setStaff((prev) => [...prev, data.staff].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      }
      setEmail('');
      setMessage(`${data.staff.full_name} can now scan tickets for this event.`);
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string) {
    setError('');
    setMessage('');
    const res = await fetch(`/api/events/${eventId}/staff?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setStaff((prev) => prev.filter((s) => s.id !== userId));
      setMessage('Staff member removed');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not remove staff');
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleInvite} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Invite staff by email</h2>
        <p className="text-xs text-gray-500">
          They must already have a TicketHub account. Staff can open the scanner and check tickets in for this
          event only — not edit the event or see payouts.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            {loading ? 'Adding…' : 'Add staff'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && <p className="text-emerald-400 text-sm">{message}</p>}
      </form>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
          Current staff ({staff.length})
        </h2>
        {staff.length === 0 ? (
          <p className="text-gray-500 text-sm">No staff yet. Invite someone who will scan at the door.</p>
        ) : (
          <ul className="space-y-2">
            {staff.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-white text-sm">{s.full_name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemove(s.id)}
                  className="text-xs font-semibold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-900/50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
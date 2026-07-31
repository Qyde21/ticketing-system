'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EventApprovalActions({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleApprove() {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/admin/events/${eventId}/approve`, { method: 'PATCH' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to approve');
    }
  }

  async function handleReject() {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/admin/events/${eventId}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to reject');
    }
  }

  if (showReject) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection (optional)"
          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={loading}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            {loading ? 'Rejecting...' : 'Confirm Reject'}
          </button>
          <button
            onClick={() => { setShowReject(false); setError(''); }}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
        >
          {loading ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={() => setShowReject(true)}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';

interface AdminEventActionsProps {
  eventId: string;
  status: string;
}

export default function AdminEventActions({ eventId, status }: AdminEventActionsProps) {
  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this event?')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/cancel`, { method: 'PATCH' });
      if (res.ok) window.location.reload();
      else alert('Failed to cancel event');
    } catch {
      alert('An error occurred while cancelling');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this event? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) window.location.reload();
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete event');
      }
    } catch {
      alert('An error occurred while deleting');
    }
  };

  const linkClass =
    'text-xs font-semibold text-indigo-300 hover:text-cyan-300 px-2 py-1 rounded border border-gray-700 bg-gray-900/80';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Link href={`/admin/events/${eventId}/orders`} className={linkClass}>Orders</Link>
      <Link href={`/admin/events/${eventId}/analytics`} className={linkClass}>Analytics</Link>
      <Link href={`/organizer/events/${eventId}/scan-overview`} className={linkClass}>Scan</Link>
      <Link href={`/organizer/events/${eventId}/staff`} className={linkClass}>Staff</Link>
      <Link href={`/organizer/events/${eventId}/shifts`} className={linkClass}>Shifts</Link>
      {status !== 'cancelled' ? (
        <button type="button" onClick={handleCancel} className="text-xs font-semibold text-yellow-400 px-2 py-1">
          Cancel
        </button>
      ) : (
        <span className="text-xs text-gray-500 italic">Cancelled</span>
      )}
      <button
        type="button"
        onClick={handleDelete}
        className="text-xs font-semibold text-red-400 px-2 py-1 border border-red-800 rounded"
      >
        Delete
      </button>
    </div>
  );
}

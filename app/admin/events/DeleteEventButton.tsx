'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Are you sure you want to permanently delete this event? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete event');
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (err) {
      alert('An unexpected error occurred');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow disabled:opacity-50"
    >
      {loading ? 'Deleting...' : 'Delete Event'}
    </button>
  );
}
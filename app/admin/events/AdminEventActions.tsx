'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminEventActionsProps {
  eventId: string;
  status: string;
  title?: string;
}

export default function AdminEventActions({ eventId, status, title }: AdminEventActionsProps) {
  const [loading, setLoading] = useState<'cancel' | 'delete' | null>(null);
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirm(`Cancel "${title || 'this event'}"?\n\nIt will stop ticket sales. Paid tickets stay valid until you refund.`)) {
      return;
    }
    setLoading('cancel');
    try {
      const res = await fetch(`/api/events/${eventId}/cancel`, { method: 'PATCH' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to cancel event');
      }
    } catch {
      alert('An error occurred while cancelling');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    const label = title || 'this event';
    if (
      !confirm(
        `Permanently delete "${label}"?\n\nOnly allowed if there are no paid orders (drafts, copies, test events).\nThis cannot be undone.`
      )
    ) {
      return;
    }

    setLoading('delete');
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to delete event');
        setLoading(null);
        return;
      }
      router.refresh();
    } catch {
      alert('An error occurred while deleting');
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {status !== 'cancelled' && (
        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={!!loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 transition disabled:opacity-50"
        >
          {loading === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={!!loading}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-700/70 bg-red-950/50 text-red-300 hover:bg-red-900/60 transition disabled:opacity-50"
      >
        {loading === 'delete' ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  );
}

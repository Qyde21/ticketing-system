'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminEventActions({ eventId, status }: { eventId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePublish() {
    setLoading(true);
    const res = await fetch('/api/events/' + eventId + '/publish', { method: 'PATCH' });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert('Failed to publish event');
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this event? All paid orders will be refunded automatically. This cannot be undone.')) return;
    setLoading(true);
    const res = await fetch('/api/events/' + eventId + '/cancel', { method: 'PATCH' });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      alert('Event cancelled. ' + data.refundedOrders + ' order(s) refunded.');
      router.refresh();
    } else {
      alert('Failed to cancel event');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      {status === 'draft' && (
        <button onClick={handlePublish} disabled={loading} style={{ fontSize: 12, color: 'green', whiteSpace: 'nowrap' }}>
          {loading ? '...' : 'Publish'}
        </button>
      )}
      {(status === 'draft' || status === 'published') && (
        <button onClick={handleCancel} disabled={loading} style={{ fontSize: 12, color: 'red', whiteSpace: 'nowrap' }}>
          {loading ? '...' : 'Cancel event'}
        </button>
      )}
      {status === 'cancelled' && (
        <span style={{ fontSize: 12, color: '#999' }}>Cancelled</span>
      )}
    </div>
  );
}
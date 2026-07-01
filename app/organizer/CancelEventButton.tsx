'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CancelEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm('Cancel this event? All paid orders will be refunded automatically.')) return;
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/cancel`, { method: 'PATCH' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert('Failed to cancel event');
    }
  }

  return (
    <button onClick={handleCancel} disabled={loading} style={{ marginLeft: 8 }}>
      {loading ? 'Cancelling...' : 'Cancel event'}
    </button>
  );
}

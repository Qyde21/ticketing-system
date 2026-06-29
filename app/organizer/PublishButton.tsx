'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PublishButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePublish() {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/publish`, { method: 'PATCH' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert('Failed to publish event');
    }
  }

  return (
    <button onClick={handlePublish} disabled={loading}>
      {loading ? 'Publishing...' : 'Publish'}
    </button>
  );
}
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
      alert('Failed to submit event for review');
    }
  }

  return (
    <button
      onClick={handlePublish}
      disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold transition"
    >
      {loading ? 'Submitting...' : 'Submit for Review'}
    </button>
  );
}
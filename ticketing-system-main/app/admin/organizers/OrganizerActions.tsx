'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function OrganizerActions({ userId, isVerified }: { userId: string; isVerified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    const res = await fetch(`/api/admin/organizers/${userId}/approve`, { method: 'PATCH' });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert('Failed to approve organizer');
  }

  async function handleSuspend() {
    if (!confirm('Suspend this organizer? They will lose access to their dashboard.')) return;
    setLoading(true);
    const res = await fetch(`/api/admin/organizers/${userId}/suspend`, { method: 'PATCH' });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert('Failed to suspend organizer');
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {!isVerified && (
        <button onClick={handleApprove} disabled={loading} style={{ fontSize: 13, color: 'green' }}>
          {loading ? 'Approving...' : 'Approve'}
        </button>
      )}
      <button onClick={handleSuspend} disabled={loading} style={{ fontSize: 13, color: 'red' }}>
        {loading ? 'Suspending...' : 'Suspend'}
      </button>
    </div>
  );
}

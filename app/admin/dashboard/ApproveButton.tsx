'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ApproveButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    const res = await fetch(`/api/admin/organizers/${userId}/approve`, { method: 'PATCH' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert('Failed to approve organizer');
    }
  }

  return (
    <button onClick={handleApprove} disabled={loading} style={{ marginLeft: 8 }}>
      {loading ? 'Approving...' : 'Approve'}
    </button>
  );
}
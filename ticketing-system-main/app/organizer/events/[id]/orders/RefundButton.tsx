'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRefund() {
    if (!confirm('Refund this order? This cannot be undone.')) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/refund`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || 'Refund failed');
    }
  }

  return (
    <button
      onClick={handleRefund}
      disabled={loading}
      className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 font-semibold px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50 ml-2"
    >
      {loading ? 'Refunding...' : 'Refund'}
    </button>
  );
}

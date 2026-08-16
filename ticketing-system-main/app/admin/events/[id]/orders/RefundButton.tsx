'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RefundButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRefund = async () => {
    if (!confirm('Are you sure you want to process a refund for this order?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/refund`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process refund');
      }

      alert('Refund processed successfully!');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRefund}
      disabled={loading}
      className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 font-semibold px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
    >
      {loading ? 'Processing...' : 'Refund Order'}
    </button>
  );
}
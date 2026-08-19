'use client';

import { useState } from 'react';

export default function AdminProcessPayoutButton({ payoutId }: { payoutId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`, { method: 'POST' });
      const data = await res.json();
      setMsg(res.ok ? `OK: ${data.status}` : data.error || 'Failed');
    } catch {
      setMsg('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void run()} disabled={loading}
        className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold">
        {loading ? '…' : 'Process transfer'}
      </button>
      {msg && <div className="text-[10px] text-gray-400 mt-1">{msg}</div>}
    </div>
  );
}

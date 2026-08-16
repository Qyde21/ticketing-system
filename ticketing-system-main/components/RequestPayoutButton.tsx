'use client';

import { useState } from 'react';

export default function RequestPayoutButton({
  eventId,
  netKes,
  disabledReason,
}: {
  eventId: string;
  netKes: number;
  disabledReason?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function request() {
    if (disabledReason) return;
    setLoading(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch('/api/organizer/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, process: true }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Failed');
      else setMsg(data.status === 'paid' ? 'Paid out successfully' : `Status: ${data.status}`);
    } catch {
      setErr('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button type="button" disabled={loading || Boolean(disabledReason) || netKes < 50}
        onClick={() => void request()}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white">
        {loading ? '…' : 'Request payout'}
      </button>
      {disabledReason && <div className="text-[10px] text-gray-500 mt-1">{disabledReason}</div>}
      {msg && <div className="text-[10px] text-emerald-400 mt-1">{msg}</div>}
      {err && <div className="text-[10px] text-red-400 mt-1">{err}</div>}
    </div>
  );
}

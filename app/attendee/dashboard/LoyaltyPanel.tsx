'use client';
import { useState } from 'react';

type Tier = 'Bronze' | 'Silver' | 'Gold';

interface Summary {
  balance: number;
  lifetimeEarned: number;
  tier: Tier;
}

const TIER_STYLES: Record<Tier, { bg: string; text: string; ring: string }> = {
  Bronze: { bg: 'bg-amber-950/50', text: 'text-amber-400', ring: 'border-amber-800' },
  Silver: { bg: 'bg-slate-800/60', text: 'text-slate-300', ring: 'border-slate-600' },
  Gold: { bg: 'bg-yellow-950/40', text: 'text-yellow-400', ring: 'border-yellow-700' },
};

export default function LoyaltyPanel({
  initialSummary,
  events,
}: {
  initialSummary: Summary;
  events: { id: string; title: string }[];
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id || '');
  const [points, setPoints] = useState(Math.min(100, summary.balance));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; discountKes: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const tierStyle = TIER_STYLES[summary.tier];

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!eventId) {
      setError('Pick an event to redeem toward');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, points }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not redeem points');
        return;
      }
      setResult({ code: data.code, discountKes: data.discountKes });
      setSummary((s) => ({ ...s, balance: s.balance - points }));
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!result) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Loyalty points</p>
            <p className="text-2xl font-extrabold text-white">{summary.balance.toLocaleString()}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.ring}`}>
            {summary.tier} member
          </span>
        </div>
        {events.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-sm font-semibold text-indigo-400 hover:text-cyan-400"
          >
            {open ? 'Close' : 'Redeem points →'}
          </button>
        )}
      </div>

      {summary.lifetimeEarned > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {summary.lifetimeEarned.toLocaleString()} points earned lifetime. Earn 1 point per KES 100 spent.
        </p>
      )}

      {open && (
        <form onSubmit={handleRedeem} className="mt-4 pt-4 border-t border-gray-800 space-y-3">
          {result ? (
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4">
              <p className="text-emerald-300 text-sm font-semibold mb-2">
                Redeemed! KES {result.discountKes.toLocaleString()} off your next order.
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white flex-1">
                  {result.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Apply this code at checkout for the event you picked. Expires in 30 days, single use.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Redeem toward
                </label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Points to redeem (min 100, 1 point = KES 1 off)
                </label>
                <input
                  type="number"
                  min={100}
                  step={10}
                  max={summary.balance}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || summary.balance < 100}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition"
              >
                {busy ? 'Redeeming...' : summary.balance < 100 ? 'Not enough points yet' : 'Get discount code'}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
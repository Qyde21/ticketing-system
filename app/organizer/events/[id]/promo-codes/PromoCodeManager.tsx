'use client';

import { useState } from 'react';

interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: string | number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export default function PromoCodeManager({ eventId, initialCodes }: { eventId: string; initialCodes: PromoCode[] }) {
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);
  const [showForm, setShowForm] = useState(false);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!code.trim() || !discountValue) {
      setError('Code and discount value are required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          code,
          discountType,
          discountValue: Number(discountValue),
          maxUses: maxUses ? Number(maxUses) : null,
          expiresAt: expiresAt || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create promo code');
        setLoading(false);
        return;
      }

      setCodes((prev) => [data.code, ...prev]);
      setCode('');
      setDiscountValue('');
      setMaxUses('');
      setExpiresAt('');
      setShowForm(false);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    const res = await fetch(`/api/promo-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !currentActive }),
    });
    if (res.ok) {
      const data = await res.json();
      setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, active: data.code.active } : c)));
    }
  }

  const inputClass = 'w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition';
  const labelClass = 'block text-xs font-semibold text-gray-300 mb-1.5';

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
        >
          + Create Promo Code
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EARLYBIRD20"
              className={inputClass + ' uppercase'}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Discount Type</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')} className={inputClass}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount (KES)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>{discountType === 'percent' ? 'Percent off' : 'Amount off (KES)'}</label>
              <input
                type="number"
                min="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? '20' : '500'}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Max Uses (optional)</label>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Expires (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
            >
              {loading ? 'Creating...' : 'Create Code'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg text-sm transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {codes.length === 0 ? (
        <p className="text-gray-400">No promo codes yet. Create one to give buyers a discount at checkout.</p>
      ) : (
        <ul className="list-none p-0 flex flex-col gap-3">
          {codes.map((c) => {
            const isExpired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
            const isMaxedOut = c.max_uses !== null && c.uses_count >= c.max_uses;
            const effectivelyActive = c.active && !isExpired && !isMaxedOut;

            return (
              <li key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{c.code}</span>
                    <span
                      className={
                        'text-xs font-semibold px-2 py-0.5 rounded-full ' +
                        (effectivelyActive
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                          : 'bg-gray-800 text-gray-400 border border-gray-700')
                      }
                    >
                      {!c.active ? 'Disabled' : isExpired ? 'Expired' : isMaxedOut ? 'Limit reached' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.discount_type === 'percent' ? `${c.discount_value}% off` : `KES ${Number(c.discount_value).toLocaleString()} off`}
                    {' '}&middot; Used {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ''} time{c.uses_count === 1 ? '' : 's'}
                    {c.expires_at && ` \u00b7 Expires ${new Date(c.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleActive(c.id, c.active)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                >
                  {c.active ? 'Disable' : 'Enable'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

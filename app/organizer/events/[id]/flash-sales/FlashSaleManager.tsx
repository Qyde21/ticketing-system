'use client';

import { useState } from 'react';

interface TicketType {
  id: string;
  name: string;
  price_kes: number;
  quantity_total: number;
  quantity_sold: number;
  flash_sale_price_kes: number | null;
  flash_sale_starts_at: string | null;
  flash_sale_ends_at: string | null;
  flash_sale_quantity_cap: number | null;
  flash_sale_quantity_sold: number;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isFlashActive(t: TicketType): boolean {
  if (!t.flash_sale_price_kes || !t.flash_sale_starts_at || !t.flash_sale_ends_at) return false;
  const now = new Date();
  const capReached = t.flash_sale_quantity_cap !== null && t.flash_sale_quantity_sold >= t.flash_sale_quantity_cap;
  return now >= new Date(t.flash_sale_starts_at) && now <= new Date(t.flash_sale_ends_at) && !capReached;
}

export default function FlashSaleManager({ ticketTypes }: { ticketTypes: TicketType[] }) {
  const [tiers, setTiers] = useState(ticketTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ price: '', startsAt: '', endsAt: '', cap: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startEdit = (t: TicketType) => {
    setEditingId(t.id);
    setError('');
    setForm({
      price: t.flash_sale_price_kes ? String(t.flash_sale_price_kes) : '',
      startsAt: toDatetimeLocal(t.flash_sale_starts_at) || toDatetimeLocal(new Date().toISOString()),
      endsAt: toDatetimeLocal(t.flash_sale_ends_at),
      cap: t.flash_sale_quantity_cap ? String(t.flash_sale_quantity_cap) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  const submit = async (ticketTypeId: string) => {
    setError('');
    if (!form.price || !form.startsAt || !form.endsAt) {
      setError('Price, start time, and end time are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ticket-types/${ticketTypeId}/flash-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashPriceKes: Number(form.price),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          quantityCap: form.cap ? Number(form.cap) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setTiers((prev) => prev.map((t) => (t.id === ticketTypeId ? { ...t, ...data.ticketType } : t)));
      setEditingId(null);
    } catch (e) {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancelFlashSale = async (ticketTypeId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ticket-types/${ticketTypeId}/flash-sale`, { method: 'DELETE' });
      if (res.ok) {
        setTiers((prev) =>
          prev.map((t) =>
            t.id === ticketTypeId
              ? { ...t, flash_sale_price_kes: null, flash_sale_starts_at: null, flash_sale_ends_at: null, flash_sale_quantity_cap: null, flash_sale_quantity_sold: 0 }
              : t
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {tiers.length === 0 && <p className="text-gray-400">No ticket tiers found for this event.</p>}

      {tiers.map((t) => {
        const active = isFlashActive(t);
        const hasFlashConfigured = !!t.flash_sale_price_kes;

        return (
          <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-bold text-white flex items-center gap-2">
                  {t.name}
                  {active && (
                    <span className="flash-sale-badge animate-pulse text-[10px] uppercase tracking-wider font-extrabold bg-amber-500 text-black px-2 py-0.5 rounded-full">
                      Live Now
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">Regular price: KES {Number(t.price_kes).toLocaleString()}</p>
                {hasFlashConfigured && (
                  <p className="text-xs text-amber-400 font-semibold mt-1">
                    Flash price: KES {Number(t.flash_sale_price_kes).toLocaleString()}
                    {' '}&middot;{' '}
                    {new Date(t.flash_sale_starts_at!).toLocaleString()} &rarr; {new Date(t.flash_sale_ends_at!).toLocaleString()}
                    {t.flash_sale_quantity_cap && (
                      <> &middot; {t.flash_sale_quantity_sold}/{t.flash_sale_quantity_cap} claimed</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {hasFlashConfigured && (
                  <button
                    onClick={() => cancelFlashSale(t.id)}
                    disabled={loading}
                    className="text-xs bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 px-3 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    Cancel Flash Sale
                  </button>
                )}
                <button
                  onClick={() => (editingId === t.id ? cancelEdit() : startEdit(t))}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-gray-700 px-3 py-2 rounded-lg font-semibold transition"
                >
                  {editingId === t.id ? 'Close' : hasFlashConfigured ? 'Edit Flash Sale' : 'Start Flash Sale'}
                </button>
              </div>
            </div>

            {editingId === t.id && (
              <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Flash Price (KES)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder={`< ${t.price_kes}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Starts</label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Ends</label>
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="max-w-xs">
                  <label className="text-xs text-gray-400 block mb-1">Quantity Cap (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.cap}
                    onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="e.g. 20 — leave blank for no cap"
                  />
                </div>
                <button
                  onClick={() => submit(t.id)}
                  disabled={loading}
                  className="flash-sale-badge bg-amber-600 hover:bg-amber-500 text-black font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Flash Sale'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

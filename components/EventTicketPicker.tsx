'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FlashSaleCountdown from '@/components/FlashSaleCountdown';
import JoinWaitlistButton from '@/components/JoinWaitlistButton';

type Tier = {
  id: string;
  name: string;
  price_kes: number | string;
  quantity_total: number | string;
  quantity_sold: number | string;
  max_per_order?: number | string | null;
  flash_sale_price_kes?: number | string | null;
  flash_sale_starts_at?: string | null;
  flash_sale_ends_at?: string | null;
  flash_sale_quantity_cap?: number | string | null;
  flash_sale_quantity_sold?: number | string | null;
};

function unitPrice(t: Tier, now: Date) {
  const flashCapReached =
    t.flash_sale_quantity_cap !== null &&
    t.flash_sale_quantity_cap !== undefined &&
    Number(t.flash_sale_quantity_sold || 0) >= Number(t.flash_sale_quantity_cap);
  const flashActive =
    t.flash_sale_price_kes !== null &&
    t.flash_sale_price_kes !== undefined &&
    t.flash_sale_starts_at &&
    t.flash_sale_ends_at &&
    now >= new Date(t.flash_sale_starts_at) &&
    now <= new Date(t.flash_sale_ends_at) &&
    !flashCapReached;
  return {
    flashActive,
    price: flashActive ? Number(t.flash_sale_price_kes) : Number(t.price_kes),
    regular: Number(t.price_kes),
  };
}

export default function EventTicketPicker({
  eventId,
  ticketTypes,
}: {
  eventId: string;
  ticketTypes: Tier[];
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const now = useMemo(() => new Date(), []);

  const lines = useMemo(() => {
    return ticketTypes
      .map((t) => {
        const q = qty[t.id] || 0;
        if (q <= 0) return null;
        const { price, flashActive } = unitPrice(t, now);
        return { id: t.id, name: t.name, quantity: q, unitPrice: price, flashActive, lineTotal: price * q };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      flashActive: boolean;
      lineTotal: number;
    }>;
  }, [qty, ticketTypes, now]);

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const totalKes = lines.reduce((s, l) => s + l.lineTotal, 0);

  const setTierQty = (id: string, next: number, max: number) => {
    const capped = Math.max(0, Math.min(max, next));
    setQty((prev) => {
      const copy = { ...prev };
      if (capped <= 0) delete copy[id];
      else copy[id] = capped;
      return copy;
    });
  };

  const goCheckout = () => {
    if (lines.length === 0) return;
    const items = lines.map((l) => `${l.id}:${l.quantity}`).join(',');
    router.push(`/checkout/event/${eventId}?items=${encodeURIComponent(items)}`);
  };

  return (
    <div className="space-y-3">
      {ticketTypes.map((t) => {
        const total = Number(t.quantity_total || 0);
        const remaining = Math.max(0, total - Number(t.quantity_sold || 0));
        const soldOut = remaining <= 0;
        const percentSold = total > 0 ? Math.floor((Number(t.quantity_sold || 0) / total) * 100) : 0;
        const almostSoldOut = total > 0 && !soldOut && percentSold >= 90;
        const maxPerOrder = Number(t.max_per_order || 10);
        const maxQty = Math.min(remaining, maxPerOrder);
        const { flashActive, price, regular } = unitPrice(t, now);
        const current = qty[t.id] || 0;

        return (
          <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900 border border-gray-800 p-4 rounded-xl">
            <div>
              <p className="font-bold text-white flex items-center gap-2 flex-wrap">
                {t.name}
                {flashActive && (
                  <span className="flash-sale-badge animate-pulse text-[10px] uppercase tracking-wider font-extrabold bg-amber-500 text-black px-2 py-0.5 rounded-full">
                    Flash Sale
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400">
                {flashActive ? (
                  <>
                    <span className="line-through text-gray-500 mr-1.5">KES {regular.toLocaleString()}</span>
                    <span className="text-amber-400 font-bold">KES {price.toLocaleString()}</span>{' '}
                    {t.flash_sale_ends_at && <FlashSaleCountdown endsAt={t.flash_sale_ends_at} />}
                  </>
                ) : (
                  <>KES {regular.toLocaleString()}</>
                )}
                {soldOut && <span> · Sold out</span>}
                {almostSoldOut && <span className="text-amber-400 font-bold"> · Almost sold out!</span>}
                {!soldOut && <span className="text-gray-500"> · {remaining} left</span>}
              </p>
            </div>

            {soldOut ? (
              <JoinWaitlistButton ticketTypeId={t.id} />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTierQty(t.id, current - 1, maxQty)}
                  className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold hover:bg-gray-700"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold text-white">{current}</span>
                <button
                  type="button"
                  onClick={() => setTierQty(t.id, current + 1, maxQty)}
                  className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold hover:bg-gray-700"
                  aria-label="Increase"
                  disabled={current >= maxQty}
                >
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}

      {totalQty > 0 && (
        <div className="sticky bottom-4 z-10 mt-4 rounded-2xl border border-indigo-800/60 bg-gray-950/95 backdrop-blur p-4 shadow-xl shadow-indigo-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-300">
                <span className="font-bold text-white">{totalQty}</span> ticket{totalQty === 1 ? '' : 's'} selected
              </p>
              <p className="text-lg font-extrabold text-cyan-400">KES {totalKes.toLocaleString()}</p>
              <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
                {lines.map((l) => (
                  <li key={l.id}>
                    {l.quantity}× {l.name}
                    {l.flashActive ? ' (flash)' : ''} — KES {l.lineTotal.toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={goCheckout}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 text-sm"
            >
              Checkout →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
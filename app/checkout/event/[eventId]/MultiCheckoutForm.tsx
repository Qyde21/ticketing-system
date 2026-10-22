'use client';

import { useEffect, useMemo, useState } from 'react';

type Line = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  flashActive?: boolean;
};

export default function MultiCheckoutForm({
  event,
  lines,
}: {
  event: { id: string; title: string };
  lines: Line[];
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'checking' | 'applied' | 'error'>('idle');
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
    discountType: string;
    discountValue: number;
  } | null>(null);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const totalAmount = appliedPromo ? appliedPromo.finalAmount : subtotal;
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  useEffect(() => {
    if (appliedPromo) {
      setAppliedPromo(null);
      setPromoStatus('idle');
      setPromoError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines.map((l) => [l.id, l.quantity]))]);

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || lines.length === 0) return;
    setPromoStatus('checking');
    setPromoError('');
    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeId: lines[0].id,
          quantity: totalQty,
          code: promoInput,
          subtotalKes: subtotal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedPromo({
          code: promoInput.trim().toUpperCase(),
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount,
          discountType: data.discountType,
          discountValue: data.discountValue,
        });
        setPromoStatus('applied');
      } else {
        setPromoStatus('error');
        setPromoError(data.error || 'Invalid promo code');
      }
    } catch {
      setPromoStatus('error');
      setPromoError('Could not check promo code. Please try again.');
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          items: lines.map((l) => ({ ticketTypeId: l.id, quantity: l.quantity })),
          buyerName: fullName,
          buyerEmail: email,
          buyerPhone: phone,
          promoCode: appliedPromo ? appliedPromo.code : undefined,
        }),
      });
      const data = await res.json();
      const paystackUrl = data.authorizationUrl || data.authorization_url;
      if (res.ok && paystackUrl) {
        window.location.href = paystackUrl;
      } else if (res.ok && data.isFree && data.reference) {
        window.location.href = `/success?reference=${data.reference}`;
      } else {
        alert(data.error || 'Failed to initialize payment');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during checkout.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCheckout} className="space-y-6 bg-neutral-50 border border-black/10 p-6 rounded-2xl">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-3">Your tickets</h2>
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between text-sm bg-white border border-black/10 rounded-xl px-3 py-2">
              <span className="text-black">
                {l.quantity}× {l.name}
                {l.flashActive ? <span className="text-amber-600 text-xs ml-1">Flash</span> : null}
              </span>
              <span className="text-cyan-400 font-semibold">KES {l.lineTotal.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Full Name</label>
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-white border border-black/10 rounded-xl p-3 text-black text-sm focus:outline-none focus:border-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Email Address</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-black/10 rounded-xl p-3 text-black text-sm focus:outline-none focus:border-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Phone Number</label>
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white border border-black/10 rounded-xl p-3 text-black text-sm focus:outline-none focus:border-indigo-500" />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Promo Code</label>
        {appliedPromo ? (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div>
              <span className="text-emerald-700 font-bold text-sm">{appliedPromo.code}</span>
              <span className="text-emerald-600 text-xs ml-2">
                (−KES {appliedPromo.discountAmount.toLocaleString()})
              </span>
            </div>
            <button type="button" onClick={() => { setAppliedPromo(null); setPromoStatus('idle'); setPromoInput(''); }} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Optional"
              className="flex-1 bg-white border border-black/10 rounded-xl p-3 text-black text-sm focus:outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={handleApplyPromo} disabled={promoStatus === 'checking'} className="px-4 rounded-xl bg-neutral-100 border border-black/15 text-sm font-semibold text-black hover:bg-neutral-200">
              {promoStatus === 'checking' ? '…' : 'Apply'}
            </button>
          </div>
        )}
        {promoStatus === 'error' && <p className="text-red-600 text-xs mt-1">{promoError}</p>}
      </div>

      <div className="border-t border-black/10 pt-4 space-y-1">
        <div className="flex justify-between text-sm text-neutral-500">
          <span>Subtotal ({totalQty} tickets)</span>
          <span>KES {subtotal.toLocaleString()}</span>
        </div>
        {appliedPromo && (
          <div className="flex justify-between text-sm text-emerald-600">
            <span>Discount</span>
            <span>−KES {appliedPromo.discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-extrabold text-black">
          <span>Total</span>
          <span className="text-cyan-400">KES {totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || lines.length === 0}
        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold uppercase tracking-wider transition"
      >
        {loading ? 'Processing…' : totalAmount <= 0 ? 'Get free tickets' : `Pay KES ${totalAmount.toLocaleString()}`}
      </button>
    </form>
  );
}
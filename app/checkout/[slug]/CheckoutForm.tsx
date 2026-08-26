'use client';

import { useState, useEffect } from 'react';

export default function CheckoutForm({ event, ticketTypes }: { event: any, ticketTypes: any[] }) {
  const safeTickets = Array.isArray(ticketTypes) ? ticketTypes : [];
  const defaultTicket = safeTickets[0] || { id: '', name: 'General Admission', price_kes: 0 };

  const [selectedTicketId, setSelectedTicketId] = useState(defaultTicket.id);
  const [quantity, setQuantity] = useState(1);
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

  const selectedTicket = safeTickets.find(t => t && t.id === selectedTicketId) || defaultTicket;
  const unitPrice = Number(selectedTicket.price_kes || selectedTicket.price || 0);
  const subtotal = unitPrice * quantity;
  const totalAmount = appliedPromo ? appliedPromo.finalAmount : subtotal;

  // If the buyer changes their ticket tier or quantity, the previously applied
  // discount no longer matches the new subtotal, so they need to re-apply it.
  useEffect(() => {
    if (appliedPromo) {
      setAppliedPromo(null);
      setPromoStatus('idle');
      setPromoError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId, quantity]);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoStatus('checking');
    setPromoError('');

    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeId: selectedTicketId,
          quantity,
          code: promoInput,
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
    } catch (err) {
      setPromoStatus('error');
      setPromoError('Could not check promo code. Please try again.');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoStatus('idle');
    setPromoInput('');
    setPromoError('');
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeId: selectedTicketId,
          quantity,
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
        const claimQ = data.claimToken ? `&claim=${encodeURIComponent(data.claimToken)}` : '';
        window.location.href = `/success?reference=${encodeURIComponent(data.reference)}${claimQ}`;
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
    <form onSubmit={handleCheckout} className="space-y-6 bg-gray-950 border border-gray-800 p-6 rounded-2xl">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Select Ticket Tier</label>
        <select
          value={selectedTicketId}
          onChange={(e) => setSelectedTicketId(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
        >
          {safeTickets.map((t) => t && t.id ? (
            <option key={t.id} value={t.id}>
              {t.name} - KES {Number(t.price_kes || t.price || 0).toLocaleString()}
            </option>
          ) : null)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Ticket Quantity</label>
        <input
          type="number"
          min="1"
          max="10"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Full Name</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Kirui Gideon"
          className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="kiruiqyde@gmail.com"
          className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Phone Number</label>
        <input
          type="text"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0114525941"
          className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Promo Code</label>
        {appliedPromo ? (
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3">
            <div>
              <span className="text-emerald-300 font-bold text-sm">{appliedPromo.code}</span>
              <span className="text-emerald-400 text-xs ml-2">
                ({appliedPromo.discountType === 'percent' ? `${appliedPromo.discountValue}% off` : `KES ${appliedPromo.discountValue.toLocaleString()} off`})
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemovePromo}
              className="text-xs text-gray-400 hover:text-red-400 font-semibold"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Enter code"
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500 uppercase"
            />
            <button
              type="button"
              onClick={handleApplyPromo}
              disabled={promoStatus === 'checking' || !promoInput.trim()}
              className="px-5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition"
            >
              {promoStatus === 'checking' ? '...' : 'Apply'}
            </button>
          </div>
        )}
        {promoStatus === 'error' && (
          <p className="text-red-400 text-xs mt-1.5">{promoError}</p>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
        {appliedPromo && (
          <div className="flex justify-between items-center text-xs text-gray-400 mb-2 pb-2 border-b border-gray-800">
            <span>Subtotal</span>
            <span>KES {subtotal.toLocaleString()}</span>
          </div>
        )}
        {appliedPromo && (
          <div className="flex justify-between items-center text-xs text-emerald-400 mb-2">
            <span>Discount</span>
            <span>-KES {appliedPromo.discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm font-bold">Total Amount:</span>
          <span className="text-cyan-400 font-extrabold text-xl">{totalAmount > 0 ? `KES ${totalAmount.toLocaleString()}` : 'FREE'}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={
          'w-full py-3 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg disabled:opacity-50 ' +
          (totalAmount > 0 ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/50' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50')
        }
      >
        {loading ? 'Processing...' : totalAmount > 0 ? 'Proceed to Paystack' : 'Get Free Ticket'}
      </button>
    </form>
  );
}


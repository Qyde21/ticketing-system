'use client';

import { useState } from 'react';

export default function CheckoutForm({ event, ticketTypes }: { event: any, ticketTypes: any[] }) {
  const safeTickets = Array.isArray(ticketTypes) ? ticketTypes : [];
  const defaultTicket = safeTickets[0] || { id: '', name: 'General Admission', price_kes: 0 };

  const [selectedTicketId, setSelectedTicketId] = useState(defaultTicket.id);
  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedTicket = safeTickets.find(t => t && t.id === selectedTicketId) || defaultTicket;
  const unitPrice = Number(selectedTicket.price_kes || selectedTicket.price || 0);
  const totalAmount = unitPrice * quantity;

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
        }),
      });

      const data = await res.json();
      const paystackUrl = data.authorizationUrl || data.authorization_url;

      if (res.ok && paystackUrl) {
        window.location.href = paystackUrl;
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

      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex justify-between items-center">
        <span className="text-gray-400 text-sm font-bold">Total Amount:</span>
        <span className="text-cyan-400 font-extrabold text-xl">KES {totalAmount.toLocaleString()}</span>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Proceed to Paystack'}
      </button>
    </form>
  );
}

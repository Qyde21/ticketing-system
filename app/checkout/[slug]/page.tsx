'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CheckoutClientPage({ params }: { params: { slug: string } }) {
  // Client component wrapper or handle params
  return <CheckoutForm ticketId={params.slug} />;
}

import { useEffect } from 'react';

function CheckoutForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: ''
  });

  useEffect(() => {
    async function fetchTicket() {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`);
        // If there's no specific ticket API, we can fetch event/ticket details or pass it directly.
        // Let's implement a fallback or direct fetch from public endpoints if available.
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    }
    fetchTicket();
  }, [ticketId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: ticketId, // or get from ticket lookup
          ticketTypeId: ticketId,
          quantity: 1,
          buyerName: formData.buyerName,
          buyerEmail: formData.buyerEmail,
          buyerPhone: formData.buyerPhone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        router.push(`/tickets/${data.orderId || ticketId}`);
      }
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-white">
      <div className="mb-6">
        <Link href={`/events`} className="text-indigo-400 hover:underline text-sm font-semibold">
          ← Back to Events
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/50">
            Checkout
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">Complete Your Ticket Order</h1>
        </div>

        {error && (
          <div className="p-4 bg-red-950 border border-red-800 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">Your Full Name</label>
            <input 
              type="text" 
              required 
              value={formData.buyerName}
              onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
              placeholder="John Doe" 
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={formData.buyerEmail}
              onChange={(e) => setFormData({ ...formData, buyerEmail: e.target.value })}
              placeholder="john@example.com" 
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">Phone Number (M-PESA)</label>
            <input 
              type="text" 
              required 
              value={formData.buyerPhone}
              onChange={(e) => setFormData({ ...formData, buyerPhone: e.target.value })}
              placeholder="0712345678" 
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl uppercase tracking-wider text-sm transition shadow-lg shadow-green-950/50 mt-4 cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Complete Purchase'}
          </button>
        </form>
      </div>
    </main>
  );
}
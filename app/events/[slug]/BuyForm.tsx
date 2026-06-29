'use client';
import { useState } from 'react';

interface TicketTypeOption {
  id: string;
  name: string;
  priceKes: number;
  remaining: number;
}

export default function BuyForm({ eventId, ticketTypes }: { eventId: string; ticketTypes: TicketTypeOption[] }) {
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, ticketTypeId, quantity, buyerName, buyerEmail, buyerPhone }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    window.location.href = data.authorizationUrl;
  }

  if (ticketTypes.length === 0) {
    return <p>No tickets available for this event yet.</p>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
      <select value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)}>
        {ticketTypes.map((tt) => (
          <option key={tt.id} value={tt.id} disabled={tt.remaining <= 0}>
            {tt.name} — KES {tt.priceKes} {tt.remaining <= 0 ? '(Sold out)' : `(${tt.remaining} left)`}
          </option>
        ))}
      </select>
      <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} placeholder="Quantity" />
      <input placeholder="Full name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
      <input placeholder="Email" type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required />
      <input placeholder="Phone (e.g. 0712345678)" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} required />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>{loading ? 'Redirecting...' : 'Buy Ticket'}</button>
    </form>
  );
}
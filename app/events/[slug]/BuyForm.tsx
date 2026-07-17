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
    return <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>No tickets available for this event yet.</p>;
  }

  return (
    <div style={{ backgroundColor: '#111827', padding: '24px', borderRadius: '16px', border: '1px solid #1f2937', color: '#ffffff', maxWidth: '420px', margin: '0 auto', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
      <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', letterSpacing: '-0.025em' }}>Select Tickets</h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ticketTypes.map((tt) => {
            const isSelected = ticketTypeId === tt.id;
            const isSoldOut = tt.remaining <= 0;
            return (
              <div 
                key={tt.id} 
                onClick={() => !isSoldOut && setTicketTypeId(tt.id)}
                style={{ 
                  padding: '16px', 
                  borderRadius: '12px', 
                  border: isSelected ? '2px solid #10b981' : '1px solid #374151', 
                  backgroundColor: isSelected ? '#065f46' : '#1f2937', 
                  cursor: isSoldOut ? 'not-allowed' : 'pointer',
                  opacity: isSoldOut ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{tt.name}</div>
                  <div style={{ fontSize: '13px', color: isSelected ? '#a7f3d0' : '#9ca3af', marginTop: '2px' }}>
                    {isSoldOut ? 'Sold out' : `${tt.remaining} tickets left`}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: isSelected ? '#34d399' : '#ffffff' }}>
                  KES {tt.priceKes.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: '#9ca3af' }}>Quantity</label>
          <input 
            type="number" 
            min={1} 
            max={5}
            value={quantity} 
            onChange={(e) => setQuantity(Number(e.target.value))} 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#ffffff', fontSize: '15px', outline: 'none' }}
          />
        </div>

        <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px', marginTop: '4px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#9ca3af', marginBottom: '12px' }}>Checkout Details</h4>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input 
            placeholder="Full Name" 
            value={buyerName} 
            onChange={(e) => setBuyerName(e.target.value)} 
            required 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#ffffff', fontSize: '15px', outline: 'none' }}
          />
          <input 
            placeholder="Email Address" 
            type="email" 
            value={buyerEmail} 
            onChange={(e) => setBuyerEmail(e.target.value)} 
            required 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#ffffff', fontSize: '15px', outline: 'none' }}
          />
          <input 
            placeholder="Phone Number (e.g. 0712345678)" 
            value={buyerPhone} 
            onChange={(e) => setBuyerPhone(e.target.value)} 
            required 
            style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#ffffff', fontSize: '15px', outline: 'none' }}
          />
        </div>

        {error && <p style={{ color: '#ef4444', fontSize: '14px', margin: 0 }}>{error}</p>}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '14px', 
            borderRadius: '8px', 
            backgroundColor: '#10b981', 
            color: '#ffffff', 
            fontWeight: 700, 
            fontSize: '16px', 
            border: 'none', 
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginTop: '8px',
            boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
          }}
        >
          {loading ? 'Processing Order...' : 'Buy Ticket'}
        </button>
      </form>
    </div>
  );
}

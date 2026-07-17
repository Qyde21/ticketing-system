import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const events = await sql`SELECT * FROM events WHERE id = ${params.id} LIMIT 1`;
  const e = events[0];
  if (!e) notFound();

  return (
    <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <h1>Checkout for {e.title}</h1>
      <p>Confirm your booking for this event.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <button 
          style={{ background: '#000', color: '#fff', padding: '12px 24px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          onClick={() => alert('Processing payment...')}
        >
          Confirm Purchase
        </button>
      </div>
    </div>
  );
}

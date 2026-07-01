import { sql } from '@/lib/db';
import RefundButton from './RefundButton';

export const dynamic = 'force-dynamic';

export default async function EventOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [event] = await sql`SELECT title FROM events WHERE id = ${id}`;
  const orders = await sql`
    SELECT id, buyer_name, buyer_email, quantity, total_amount_kes, payment_status, created_at
    FROM orders WHERE event_id = ${id}
    ORDER BY created_at DESC
  `;

  if (!event) {
    return <div style={{ margin: '2rem' }}>Event not found.</div>;
  }

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto' }}>
      <h1>Orders for {event.title}</h1>
      <ul>
        {orders.map((o: any) => (
          <li key={o.id} style={{ marginBottom: 10 }}>
            {o.buyer_name} ({o.buyer_email}) - {o.quantity} ticket(s) - KES {Number(o.total_amount_kes).toLocaleString()} - {o.payment_status}
            {o.payment_status === 'paid' && <RefundButton orderId={o.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

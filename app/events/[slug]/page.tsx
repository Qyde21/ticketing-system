import { sql } from '@/lib/db';
import BuyForm from './BuyForm';

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [event] = await sql`
    SELECT id, title, description, venue_name, start_at
    FROM events WHERE slug = ${slug} AND status = 'published'
  `;

  if (!event) {
    return <div style={{ maxWidth: 600, margin: '2rem auto' }}>Event not found.</div>;
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold, max_per_order
    FROM ticket_types WHERE event_id = ${event.id}
    ORDER BY price_kes ASC
  `;

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto' }}>
      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p>{event.venue_name} — {new Date(event.start_at).toLocaleString()}</p>

      <h2>Tickets</h2>
      <BuyForm
        eventId={event.id}
        ticketTypes={ticketTypes.map((tt: any) => ({
          id: tt.id,
          name: tt.name,
          priceKes: Number(tt.price_kes),
          remaining: tt.quantity_total - tt.quantity_sold,
        }))}
      />
    </div>
  );
}
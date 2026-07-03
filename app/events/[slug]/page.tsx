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
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
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

      <div style={{ marginTop: 32, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <p style={{ margin: 0, fontSize: 14, color: '#166534' }}>
          Need help with your ticket?{' '}
          
            href={`https://wa.me/254114525941?text=Hi%20TicketHub%2C%20I%20need%20help%20with%20my%20ticket%20for%20${encodeURIComponent(event.title)}.`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#16a34a', fontWeight: 600 }}
          >
            Chat with us on WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}

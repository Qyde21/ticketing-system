import { sql } from '@/lib/db';
import BuyForm from './BuyForm';

function mapsUrl(lat: number, lng: number) {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [event] = await sql`
    SELECT id, title, description, venue_name, start_at, cover_image_url, latitude, longitude
    FROM events WHERE slug = ${slug} AND status = 'published'
  `;

  if (!event) {
    return <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>Event not found.</div>;
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold, max_per_order
    FROM ticket_types WHERE event_id = ${event.id}
    ORDER BY price_kes ASC
  `;

  const totalSold = ticketTypes.reduce((sum: number, tt: any) => sum + Number(tt.quantity_sold), 0);
  const totalCapacity = ticketTypes.reduce((sum: number, tt: any) => sum + Number(tt.quantity_total), 0);
  const totalRemaining = totalCapacity - totalSold;
  const percentSold = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;
  const waMessage = 'Hi TicketHub, I need help with my ticket for ' + event.title + '.';

  // Check if the current time has passed the event start time
  const isPastEvent = new Date(event.start_at) < new Date();

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      {event.cover_image_url && (
        <img src={event.cover_image_url} alt={event.title} style={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 12, marginBottom: 20 }} />
      )}

      <h1>{event.title}</h1>
      <p>{event.description}</p>
      <p style={{ color: isPastEvent ? '#6b7280' : '#6366f1', fontWeight: 600 }}>
        {new Date(event.start_at).toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}
        {isPastEvent && (
          <span style={{ marginLeft: 8, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
            PASSED
          </span>
        )}
      </p>
      <p style={{ color: '#666' }}>📍 {event.venue_name}</p>

      {event.latitude && event.longitude && (
        <a href={mapsUrl(event.latitude, event.longitude)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
          View on Google Maps
        </a>
      )}

      <div style={{ margin: '20px 0', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
          <span style={{ fontWeight: 600 }}>Ticket Availability</span>
          <span style={{ color: isPastEvent ? '#6b7280' : totalRemaining === 0 ? '#dc2626' : totalRemaining < 20 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>
            {isPastEvent ? 'Sales Closed' : totalRemaining === 0 ? 'Sold out' : totalRemaining + ' remaining'}
          </span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{ width: percentSold + '%', background: isPastEvent ? '#9ca3af' : percentSold === 100 ? '#dc2626' : percentSold > 80 ? '#f59e0b' : '#6366f1', height: '100%', transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#666' }}>
          <span>{totalSold} sold</span>
          <span>{totalCapacity} total</span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ticketTypes.map((tt: any) => {
            const remaining = tt.quantity_total - tt.quantity_sold;
            return (
              <div key={tt.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: "#111827" }}>{tt.name} — KES {Number(tt.price_kes).toLocaleString()}</span>
                <span style={{ color: isPastEvent ? '#9ca3af' : remaining === 0 ? '#dc2626' : remaining < 10 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>
                  {isPastEvent ? 'Closed' : remaining === 0 ? 'Sold out' : remaining + ' left'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <h2>Buy Tickets</h2>
      {isPastEvent ? (
        <div style={{ 
          background: '#f9fafb', 
          border: '1px dashed #d1d5db', 
          borderRadius: 8, 
          padding: '24px 16px', 
          textAlign: 'center', 
          color: '#4b5563' 
        }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
            🔒 Tickets Unavailable
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            This event has ended and sales are closed.
          </p>
        </div>
      ) : (
        <BuyForm
          eventId={event.id}
          ticketTypes={ticketTypes.map((tt: any) => ({
            id: tt.id,
            name: tt.name,
            priceKes: Number(tt.price_kes),
            remaining: tt.quantity_total - tt.quantity_sold,
          }))}
        />
      )}

      <div style={{ marginTop: 32, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <p style={{ margin: 0, fontSize: 14, color: '#166534' }}>
          Need help with your ticket?{' '}
          <a href={'https://wa.me/254114525941?text=' + encodeURIComponent(waMessage)} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', fontWeight: 600 }}>
            Chat with us on WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}

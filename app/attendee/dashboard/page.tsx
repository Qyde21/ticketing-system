import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import ShareTicket from './ShareTicket';

export const dynamic = 'force-dynamic';

function mapsUrl(lat: number, lng: number) {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}

export default async function AttendeeDashboard() {
  const session = await getSession();
  if (!session) {
    return <div style={{ margin: '2rem' }}>Please log in to view your dashboard.</div>;
  }

  const lowerEmail = session.email.toLowerCase();

  const orders = await sql`
    SELECT o.id, o.total_amount_kes, o.payment_status, o.created_at, o.quantity,
           e.title, e.venue_name, e.start_at, e.slug, e.cover_image_url,
           e.latitude, e.longitude,
           array_agg(t.ticket_code) AS ticket_codes
    FROM orders o
    JOIN events e ON e.id = o.event_id
    LEFT JOIN tickets t ON t.order_id = o.id
    WHERE o.buyer_email = ${lowerEmail}
    AND o.payment_status = 'paid'
    GROUP BY o.id, e.id
    ORDER BY o.created_at DESC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>My Tickets</h1>
      <p style={{ color: '#666' }}>{orders.length} paid order(s)</p>

      {orders.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 32, textAlign: 'center', color: '#666', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          No tickets yet. <Link href="/" style={{ color: '#6366f1' }}>Browse events</Link>
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {orders.map((o: any) => (
          <li key={o.id} style={{ background: '#fff', borderRadius: 12, marginBottom: 20, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
            {o.cover_image_url && (
              <img src={o.cover_image_url} alt={o.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
            )}
            <div style={{ padding: 16 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#111827' }}>{o.title}</h2>
              <p style={{ margin: '0 0 4px', color: '#666', fontSize: 14 }}>{o.venue_name}</p>
              <p style={{ margin: '0 0 12px', color: '#6366f1', fontWeight: 600, fontSize: 14 }}>
                {new Date(o.start_at).toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}
              </p>

              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#111' }}>
                  Your tickets ({o.ticket_codes.length}):
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {o.ticket_codes.map((code: string, index: number) => (
                    <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', borderRadius: 6, padding: '8px 12px' }}>
                      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 20 }}>#{index + 1}</span>
                      <Link href={'/tickets/' + code} style={{ color: '#6366f1', fontWeight: 600, fontSize: 13, textDecoration: 'none', flex: 1 }}>
                        View Ticket
                      </Link>
                      <ShareTicket code={code} eventTitle={o.title} />
                    </div>
                  ))}
                </div>
              </div>

              {o.latitude && o.longitude ? (
                <a href={mapsUrl(o.latitude, o.longitude)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
                  View on Google Maps
                </a>
              ) : (
                <p style={{ fontSize: 13, color: '#999', margin: 0 }}>📍 {o.venue_name}</p>
              )}

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666' }}>
                <span>KES {Number(o.total_amount_kes).toLocaleString()} · {o.quantity} ticket(s)</span>
                <span>{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

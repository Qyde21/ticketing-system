import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function EventPage({ params }: { params: { slug: string } }) {
  const events = await sql`SELECT * FROM events WHERE slug = ${params.slug} LIMIT 1`;
  const e = events[0];
  if (!e) notFound();

  const apiKey = process.env.GEOAPIFY_API_KEY;

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{e.title}</h1>
      <p>{e.description}</p>

      {/* Ticket Button */}
      <div style={{ margin: '2rem 0' }}>
        <Link href={`/checkout/${e.id}`} style={{ background: '#000', color: '#fff', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 'bold' }}>
          Get Ticket
        </Link>
      </div>

      {/* Map Section */}
      {e.venue_name && (
        <div style={{ marginTop: '2rem', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <h3 style={{ marginBottom: '1rem', padding: '1rem 1rem 0' }}>Location: {e.venue_name}</h3>
          <img
            src={`https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=600&height=300&center=lonlat:36.8219,1.2921&zoom=14&apiKey=${apiKey}`}
            alt="Event Location"
            style={{ width: '100%', height: '300px', objectFit: 'cover' }}
          />
        </div>
      )}
    </div>
  );
}

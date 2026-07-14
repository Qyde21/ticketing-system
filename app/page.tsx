import { sql } from '@/lib/db';
import DiceHomeClient from './DiceHomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const events = await sql`
    SELECT e.id, e.title, e.slug, e.venue_name, e.start_at, e.cover_image_url,
           e.category,
           MIN(tt.price_kes) AS min_price,
           COALESCE(SUM(tt.quantity_total), 0) AS total_capacity,
           COALESCE(SUM(tt.quantity_sold), 0) AS total_sold
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.status = 'published'
    GROUP BY e.id
    ORDER BY e.start_at ASC
  `;

  return <DiceHomeClient events={events as any} />;
}
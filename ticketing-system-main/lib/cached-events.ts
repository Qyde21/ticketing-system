import { unstable_cache } from 'next/cache';
import { sql } from '@/lib/db';

export const getPublicEvents = unstable_cache(
  async () => {
    return sql`
      SELECT
        e.id, e.title, e.slug, e.venue_name, e.start_at, e.end_at, e.status,
        e.cover_image_url, e.category,
        COALESCE(op.is_verified, false) AS organizer_verified,
        COALESCE(SUM(tt.quantity_total), 0) AS total_capacity,
        COALESCE(SUM(tt.quantity_sold), 0) AS total_sold,
        BOOL_OR(
          tt.flash_sale_price_kes IS NOT NULL
          AND tt.flash_sale_starts_at IS NOT NULL
          AND tt.flash_sale_ends_at IS NOT NULL
          AND tt.flash_sale_starts_at <= NOW()
          AND tt.flash_sale_ends_at >= NOW()
          AND (
            tt.flash_sale_quantity_cap IS NULL
            OR tt.flash_sale_quantity_sold < tt.flash_sale_quantity_cap
          )
        ) AS has_active_flash
      FROM events e
      LEFT JOIN ticket_types tt ON tt.event_id = e.id
      LEFT JOIN organizer_profiles op ON op.user_id = e.organizer_id
      JOIN users u ON u.id = e.organizer_id
      WHERE e.status IN ('published', 'completed') AND u.status != 'suspended'
      GROUP BY e.id, op.is_verified
      ORDER BY e.start_at ASC
    `;
  },
  ['public-events'],
  { revalidate: 30, tags: ['events'] }
);
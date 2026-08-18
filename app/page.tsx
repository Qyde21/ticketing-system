import EventList from '@/components/EventList';
import FlashSaleBadge from '@/components/FlashSaleBadge';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function hasFlashFlag(v: unknown) {
  return v === true || v === 't' || v === 1 || v === '1' || v === 'true';
}

export default async function HomePage() {
  const events = await sql`
    SELECT
      e.id, e.title, e.slug, e.venue_name, e.start_at, e.end_at, e.status,
      e.cover_image_url, e.category, e.organizer_id,
      COALESCE(op.business_name, u.full_name) AS organizer_name,
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
    GROUP BY e.id, op.business_name, op.is_verified, u.full_name
    ORDER BY e.start_at ASC
  `;

  const session = await getSession();
  let favoriteIds: string[] = [];
  if (session?.userId) {
    try {
      const favs = await sql`
        SELECT event_id FROM event_favorites WHERE user_id = ${session.userId}
      `;
      favoriteIds = favs.map((r: any) => r.event_id as string);
    } catch {
      /* table may not exist yet */
    }
  }

  const now = new Date();

  const upcomingEvents = events.filter((e: any) => {
    if (e.status === 'completed') return false;
    const endDate = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
    return endDate >= now;
  });

  const pastEvents = events.filter((e: any) => {
    if (e.status === 'completed') return true;
    const endDate = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
    return endDate < now;
  });

  // Hero = next upcoming only (not forced by flash)
  const featuredEvent = upcomingEvents[0];
  const remainingUpcoming = upcomingEvents.slice(1);
  const featuredHasFlash = featuredEvent && hasFlashFlag(featuredEvent.has_active_flash);
  const flashSaleEvents = upcomingEvents.filter((e: any) => hasFlashFlag(e.has_active_flash));

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff', paddingBottom: '2rem' }}>
      {featuredEvent && (
        <div style={{ position: 'relative', width: '100%', height: 420, marginBottom: 24, borderBottom: '1px solid #1f1f1f' }}>
          {featuredEvent.cover_image_url && (
            <img
              src={featuredEvent.cover_image_url}
              alt={featuredEvent.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              padding: '24px 32px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1
                className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400"
                style={{ margin: 0, fontSize: 32 }}
              >
                {featuredEvent.title}
              </h1>
              {featuredHasFlash && <FlashSaleBadge />}
            </div>
            <p style={{ margin: '4px 0 12px 0', color: '#67e8f9', fontSize: 15, fontWeight: 600 }}>
              {featuredEvent.venue_name || 'Venue TBD'}
            </p>
            <Link
              href={`/events/${featuredEvent.slug}`}
              className="text-indigo-400 hover:text-cyan-400 font-bold"
              style={{ textDecoration: 'none', fontSize: 14 }}
            >
              View Event &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Flash sales strip â€” under hero, above Tonight / filters */}
      {flashSaleEvents.length > 0 && (
        <div style={{ maxWidth: 1000, margin: '0 auto 20px', padding: '0 1rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'linear-gradient(90deg, rgba(245,158,11,0.14), rgba(15,23,42,0.95))',
            }}
          >
            <FlashSaleBadge />
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ margin: 0, fontWeight: 800, color: '#fbbf24', fontSize: 14 }}>
                Flash sales on now
              </p>
              <p style={{ margin: '4px 0 0', color: '#d1d5db', fontSize: 13 }}>
                {flashSaleEvents.map((e: any) => e.title).join(' Â· ')}
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {flashSaleEvents.slice(0, 3).map((e: any) => (
                <Link
                  key={e.id}
                  href={`/events/${e.slug}`}
                  style={{
                    textDecoration: 'none',
                    color: '#000',
                    background: '#f59e0b',
                    padding: '8px 12px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {(e.title.length > 28 ? e.title.slice(0, 28) + 'â€¦' : e.title) + ' â†’'}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1rem' }}>
        <h2
          className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400"
          style={{ marginBottom: 20, fontSize: 22 }}
        >
          Events Coming Up
        </h2>
        {remainingUpcoming.length > 0 ? (
          <EventList events={remainingUpcoming} showFilters={true} favoriteIds={favoriteIds} />
        ) : upcomingEvents.length === 1 ? (
          <p style={{ color: '#888', marginBottom: 32 }}>More events will appear here as they are published.</p>
        ) : (
          <p style={{ color: '#888', marginBottom: 32 }}>No upcoming events right now.</p>
        )}

        {pastEvents.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ marginBottom: 16, color: '#666', fontSize: 20, fontWeight: 700 }}>Past Events</h2>
            <EventList events={pastEvents} showFilters={false} favoriteIds={favoriteIds} />
          </div>
        )}
      </div>
    </div>
  );
}

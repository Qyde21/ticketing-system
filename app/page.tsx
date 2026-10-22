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
      MIN(tt.price_kes) AS min_price,
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

  const dateFmt = (v: string) =>
    new Date(v).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Africa/Nairobi',
    });
  const priceLabel = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n === 0 ? 'Free' : `From KES ${n.toLocaleString()}`;
  };
  const heroPrice = featuredEvent ? priceLabel(featuredEvent.min_price) : null;

  return (
    <div className="min-h-screen bg-black text-white pb-8">
      {featuredEvent && (
        <section className="relative w-full h-[440px] sm:h-[540px] overflow-hidden border-b border-white/10 bg-neutral-950">
          {featuredEvent.cover_image_url && (
            <img
              src={featuredEvent.cover_image_url}
              alt={featuredEvent.title}
              className="absolute inset-0 w-full h-full object-cover opacity-75"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 pb-8 sm:pb-12 fade-up">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {featuredEvent.category && (
                  <span className="inline-block rounded-full border border-white/25 bg-white/10 backdrop-blur px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
                    {featuredEvent.category}
                  </span>
                )}
                {featuredHasFlash && <FlashSaleBadge />}
              </div>
              <h1 className="font-display text-5xl sm:text-7xl font-extrabold uppercase leading-[0.92] tracking-tight max-w-3xl">
                {featuredEvent.title}
              </h1>
              <p className="mt-3 text-base sm:text-lg text-neutral-300">
                {dateFmt(featuredEvent.start_at)} · {featuredEvent.venue_name || 'Venue TBD'}
              </p>
              <div className="mt-5 flex items-center gap-4 flex-wrap">
                <Link
                  href={`/events/${featuredEvent.slug}`}
                  className="inline-flex items-center rounded-full bg-white px-7 py-3 text-sm font-bold text-black transition hover:bg-neutral-200 active:scale-[0.98]"
                >
                  Get tickets
                </Link>
                {heroPrice && <span className="text-sm font-semibold text-neutral-200">{heroPrice}</span>}
              </div>
            </div>
          </div>
        </section>
      )}

      {flashSaleEvents.length > 0 && (
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 mt-6">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] px-4 py-3.5">
            <FlashSaleBadge />
            <div className="flex-1 min-w-[200px]">
              <p className="m-0 text-sm font-bold text-amber-300">Flash sales on now</p>
              <p className="m-0 mt-1 text-[13px] text-neutral-300">
                {flashSaleEvents.map((e: any) => e.title).join(' · ')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {flashSaleEvents.slice(0, 3).map((e: any) => (
                <Link
                  key={e.id}
                  href={`/events/${e.slug}`}
                  className="rounded-full bg-amber-500 px-3.5 py-2 text-[13px] font-bold text-black transition hover:bg-amber-400"
                >
                  {(e.title.length > 28 ? e.title.slice(0, 28) + '…' : e.title) + ' →'}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 pt-10">
        <h2 className="mb-6 font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight">
          Upcoming events
        </h2>
        {remainingUpcoming.length > 0 ? (
          <EventList events={remainingUpcoming} showFilters={true} favoriteIds={favoriteIds} />
        ) : upcomingEvents.length === 1 ? (
          <p className="mb-8 text-neutral-500">More events will appear here as they are published.</p>
        ) : (
          <p className="mb-8 text-neutral-500">No upcoming events right now.</p>
        )}

        {pastEvents.length > 0 && (
          <div className="mt-16">
            <h2 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-tight text-neutral-500">
              Past events
            </h2>
            <EventList events={pastEvents} showFilters={false} favoriteIds={favoriteIds} />
          </div>
        )}
      </div>
    </div>
  );
}

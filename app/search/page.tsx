import type { Metadata } from 'next';
import Link from 'next/link';
import EventList from '@/components/EventList';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search events | TicketHub',
  robots: { index: false, follow: true },
};

type EventRow = {
  status?: string | null;
  start_at: string | Date;
  end_at?: string | Date | null;
  [key: string]: unknown;
};

const MAX_QUERY_LENGTH = 100;
const MAX_TERMS = 6;

// Escape LIKE wildcards so user input like "100%" or "a_b" is matched literally.
function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function parseTerms(q: string) {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TERMS)
    .map(escapeLike);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').slice(0, MAX_QUERY_LENGTH).trim();
  const terms = parseTerms(q);

  let events: EventRow[] = [];
  let loadError = false;

  if (terms.length > 0) {
    try {
      // Every word must match at least one of: title, venue, address, category,
      // description or organizer name. Only public events are searched.
      events = (await sql`
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
        WHERE e.status IN ('published', 'completed')
          AND u.status != 'suspended'
          AND NOT EXISTS (
            SELECT 1 FROM unnest(${terms}::text[]) AS t(term)
            WHERE NOT (
              concat_ws(' ',
                e.title, e.venue_name, e.venue_address, e.category, e.description,
                COALESCE(op.business_name, u.full_name)
              ) ILIKE '%' || t.term || '%'
            )
          )
        GROUP BY e.id, op.business_name, op.is_verified, u.full_name
        ORDER BY e.start_at ASC
        LIMIT 100
      `) as EventRow[];
    } catch (err) {
      console.error('Search failed:', err);
      loadError = true;
    }
  }

  let favoriteIds: string[] = [];
  const session = await getSession();
  if (session?.userId && events.length > 0) {
    try {
      const favs = await sql`
        SELECT event_id FROM event_favorites WHERE user_id = ${session.userId}
      `;
      favoriteIds = favs.map((r) => r.event_id as string);
    } catch {
      /* table may not exist yet */
    }
  }

  const now = new Date();
  const isPast = (e: EventRow) => {
    if (e.status === 'completed') return true;
    const end = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
    return end < now;
  };
  const upcoming = events.filter((e) => !isPast(e));
  const past = events.filter(isPast);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-10">
      <form action="/search" method="get" role="search" className="mb-8">
        <div className="flex w-full items-center gap-3 rounded-full border border-black/10 bg-neutral-100 px-5 py-3 transition focus-within:border-black/40">
          <svg className="h-5 w-5 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Search events, venues, cities, organizers..."
            aria-label="Search events"
            className="flex-1 bg-transparent text-[15px] text-black placeholder-neutral-500 outline-none"
          />
          <button type="submit" className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">
            Search
          </button>
        </div>
      </form>

      {terms.length === 0 ? (
        <p className="text-neutral-500">Type a name, venue, city or category to find events.</p>
      ) : loadError ? (
        <p className="text-neutral-500">Search is unavailable right now. Please try again in a moment.</p>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-neutral-100 px-6 py-10 text-center">
          <p className="m-0 text-lg font-semibold text-neutral-800">No events found for &ldquo;{q}&rdquo;</p>
          <p className="m-0 mt-2 text-sm text-neutral-500">Check the spelling or try a broader word, like a city or category.</p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full border border-black/30 px-5 py-2 text-sm font-semibold text-black transition hover:bg-black hover:text-white"
          >
            Browse all events
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-neutral-500">
            {events.length} {events.length === 1 ? 'result' : 'results'} for &ldquo;{q}&rdquo;
          </p>

          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-6 font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-black">
                Upcoming
              </h2>
              <EventList events={upcoming} showFilters={false} favoriteIds={favoriteIds} />
            </div>
          )}

          {past.length > 0 && (
            <div className={upcoming.length > 0 ? 'mt-16' : ''}>
              <h2 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-tight text-neutral-400">
                Past events
              </h2>
              <EventList events={past} showFilters={false} favoriteIds={favoriteIds} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

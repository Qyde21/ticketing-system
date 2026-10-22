'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import FlashSaleBadge from '@/components/FlashSaleBadge';
import FavoriteButton from '@/components/FavoriteButton';

export default function EventList({
  events,
  showFilters = true,
  favoriteIds = [],
}: {
  events: any[];
  showFilters?: boolean;
  favoriteIds?: string[];
}) {
  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [whenFilter, setWhenFilter] = useState<'all' | 'tonight' | 'weekend'>('all');

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const day = now.getDay();
    const daysUntilSat = (6 - day + 7) % 7;
    const sat = new Date(startOfToday);
    sat.setDate(sat.getDate() + daysUntilSat);
    const monAfter = new Date(sat);
    monAfter.setDate(monAfter.getDate() + 2);

    return events.filter((e) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (e.title || '').toLowerCase().includes(q) ||
        (e.venue_name || '').toLowerCase().includes(q) ||
        (e.organizer_name || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q);
      const matchesCat = category === 'All' || (e.category && e.category === category);

      const start = e.start_at ? new Date(e.start_at) : null;
      let matchesWhen = true;
      if (whenFilter === 'tonight' && start) {
        matchesWhen = start >= startOfToday && start < endOfToday;
      } else if (whenFilter === 'weekend' && start) {
        matchesWhen = start >= sat && start < monAfter;
      }

      return matchesSearch && matchesCat && matchesWhen;
    });
  }, [search, category, whenFilter, events]);

  const pill = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
      active
        ? 'bg-white text-black'
        : 'border border-white/15 bg-transparent text-neutral-300 hover:border-white/40 hover:text-white'
    }`;

  const fmtPrice = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n === 0 ? 'Free' : `From KES ${n.toLocaleString()}`;
  };

  return (
    <div>
      {showFilters && (
        <div className="mb-8">
          <div className="mb-4 flex w-full items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 transition focus-within:border-white/40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search events, venues, organizers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder-neutral-500 outline-none"
              aria-label="Search events"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[13px] font-semibold text-neutral-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3">
            {(
              [
                { id: 'all', label: 'All dates' },
                { id: 'tonight', label: 'Tonight' },
                { id: 'weekend', label: 'This weekend' },
              ] as const
            ).map((w) => (
              <button key={w.id} type="button" onClick={() => setWhenFilter(w.id)} className={pill(whenFilter === w.id)}>
                {w.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {['All', 'Concert', 'Festival', 'Comedy', 'Autoshow', 'Sports', 'Other'].map((cat) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} className={pill(category === cat)}>
                {cat}
              </button>
            ))}
          </div>

          <p className="mt-4 text-[13px] text-neutral-500">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
            {category !== 'All' ? ` in ${category}` : ''}
          </p>
        </div>
      )}

      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-14 text-center">
          <p className="m-0 font-semibold text-neutral-200">No events found</p>
          <p className="m-0 mt-2 text-sm text-neutral-500">Try another search, category, or date filter.</p>
          {showFilters && (search || category !== 'All' || whenFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('All');
                setWhenFilter('all');
              }}
              className="mt-5 rounded-full border border-white/25 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4">
          {filteredEvents.map((e: any) => {
            const eventDate = new Date(e.start_at);
            const isPastEvent = e.end_at
              ? new Date(e.end_at) < new Date()
              : eventDate < new Date();
            const isCancelled = e.status === 'cancelled';
            const capacity = Number(e.total_capacity) || 0;
            const sold = Number(e.total_sold) || 0;
            const isSoldOut = capacity > 0 && sold >= capacity;
            const percentSold = capacity > 0 ? Math.floor((sold / capacity) * 100) : 0;
            const isAlmostSoldOut = capacity > 0 && !isSoldOut && percentSold >= 90;
            const hasFlash =
              e.has_flash_sale === true ||
              e.has_flash_sale === 1 ||
              e.has_flash_sale === 't' ||
              e.has_active_flash === true ||
              e.has_active_flash === 't';
            const price = fmtPrice(e.min_price);
            const dateLabel = e.start_at
              ? eventDate.toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'Africa/Nairobi',
                })
              : 'Date TBA';
            const href = `/events/${e.slug}`;
            const badge = 'rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide';

            return (
              <article key={e.id} className={`group relative ${isPastEvent || isCancelled ? 'opacity-70' : ''}`}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] border border-white/10 bg-neutral-900">
                  <Link href={href} aria-label={e.title} className="absolute inset-0 block">
                    {e.cover_image_url ? (
                      <img
                        src={e.cover_image_url}
                        alt={e.title}
                        loading="lazy"
                        className="event-card-img h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800 p-4 text-center font-display text-2xl font-bold uppercase text-neutral-600">
                        {e.title}
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
                  </Link>

                  <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
                    {hasFlash && !isPastEvent && !isCancelled && (
                      <span className={`${badge} bg-amber-500 text-black`}>Flash sale</span>
                    )}
                    {isCancelled ? (
                      <span className={`${badge} bg-red-800 text-white`}>Cancelled</span>
                    ) : isPastEvent ? (
                      <span className={`${badge} bg-neutral-700 text-white`}>Ended</span>
                    ) : isSoldOut ? (
                      <span className={`${badge} bg-red-600 text-white`}>Sold out</span>
                    ) : isAlmostSoldOut ? (
                      <span className={`${badge} bg-orange-600 text-white`}>Almost sold out</span>
                    ) : null}
                  </div>

                  <div className="absolute right-3 top-3 z-10">
                    <FavoriteButton eventId={e.id} initialFavorited={favSet.has(e.id)} size="sm" />
                  </div>

                  {e.category && (
                    <span className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                      {e.category}
                    </span>
                  )}
                </div>

                <div className="pt-3">
                  <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-white">
                    <Link href={href} className="hover:underline underline-offset-2">
                      {e.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-neutral-400">{dateLabel}</p>
                  <p className="truncate text-sm text-neutral-400">{e.venue_name || 'Venue TBD'}</p>
                  {e.organizer_id && e.organizer_name && (
                    <Link
                      href={`/organizers/${e.organizer_id}`}
                      className="mt-0.5 block truncate text-xs text-neutral-500 transition hover:text-white"
                    >
                      by {e.organizer_name}
                    </Link>
                  )}
                  {price && !isPastEvent && !isCancelled && (
                    <p className="mt-2 text-sm font-semibold text-white">{price}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

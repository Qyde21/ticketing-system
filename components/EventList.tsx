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

  return (
    <div>
      {showFilters && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              background: '#1f1f1f',
              border: '1px solid #333',
              marginBottom: 16,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search events, venues, organizers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: 15,
              }}
              aria-label="Search events"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10 }}>
            {(
              [
                { id: 'all', label: 'All dates' },
                { id: 'tonight', label: 'Tonight' },
                { id: 'weekend', label: 'This weekend' },
              ] as const
            ).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWhenFilter(w.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  background:
                    whenFilter === w.id
                      ? 'linear-gradient(to right, #f59e0b, #06b6d4)'
                      : '#1f1f1f',
                  color: whenFilter === w.id ? '#fff' : '#ccc',
                  border: whenFilter === w.id ? 'none' : '1px solid #333',
                  whiteSpace: 'nowrap',
                  fontWeight: whenFilter === w.id ? 700 : 500,
                }}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {['All', 'Concert', 'Festival', 'Comedy', 'Autoshow', 'Sports', 'Other'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  background:
                    category === cat
                      ? 'linear-gradient(to right, #4f46e5, #06b6d4)'
                      : '#1f1f1f',
                  color: category === cat ? '#fff' : '#ccc',
                  border: category === cat ? 'none' : '1px solid #333',
                  whiteSpace: 'nowrap',
                  fontWeight: category === cat ? 700 : 500,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: 13 }}>
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
            {category !== 'All' ? ` in ${category}` : ''}
          </p>
        </div>
      )}

      {filteredEvents.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            color: '#9ca3af',
            background: '#121212',
            borderRadius: 12,
            border: '1px solid #1f1f1f',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: '#d1d5db' }}>No events found</p>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>
            Try another search, category, or date filter.
          </p>
          {showFilters && (search || category !== 'All' || whenFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('All');
                setWhenFilter('all');
              }}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid #4f46e5',
                background: 'transparent',
                color: '#a5b4fc',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
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

            return (
              <div
                key={e.id}
                style={{
                  position: 'relative',
                  background: '#121212',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #1f1f1f',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div style={{ position: 'relative', height: 180, background: '#1a1a1a' }}>
                  {e.cover_image_url && (
                    <img
                      src={e.cover_image_url}
                      alt={e.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}>
                    <FavoriteButton
                      eventId={e.id}
                      initialFavorited={favSet.has(e.id)}
                      size="sm"
                    />
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      alignItems: 'flex-end',
                    }}
                  >
                    {hasFlash && !isPastEvent && !isCancelled && (
                      <div
                        className="animate-pulse"
                        style={{
                          background: 'linear-gradient(to right, #f59e0b, #ef4444)',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.03em',
                        }}
                      >
                        FLASH SALE
                      </div>
                    )}
                    {isCancelled ? (
                      <div
                        style={{
                          background: '#7f1d1d',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        CANCELLED
                      </div>
                    ) : isPastEvent ? (
                      <div
                        style={{
                          background: '#4b5563',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ENDED
                      </div>
                    ) : isSoldOut ? (
                      <div
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        SOLD OUT
                      </div>
                    ) : isAlmostSoldOut ? (
                      <div
                        style={{
                          background: '#d97706',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ALMOST SOLD OUT
                      </div>
                    ) : null}
                  </div>
                </div>
                <div style={{ padding: 16 }}>
                  <h3
                    className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400"
                    style={{ fontSize: 17, marginBottom: 4 }}
                  >
                    {e.title}
                  </h3>
                  {e.organizer_id && e.organizer_name && (
                    <Link
                      href={`/organizers/${e.organizer_id}`}
                      className="inline-flex items-center gap-1 text-gray-400 hover:text-cyan-400"
                      style={{ fontSize: 12, marginBottom: 8, textDecoration: 'none' }}
                    >
                      by {e.organizer_name}
                    </Link>
                  )}
                  <p className="text-gray-400 text-xs mb-1">
                    {e.start_at
                      ? eventDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Date TBA'}
                  </p>
                  <p className="text-gray-400 text-xs mb-3">{e.venue_name || 'Venue TBD'}</p>
                  <Link
                    href={`/events/${e.slug}`}
                    className="text-indigo-400 hover:text-cyan-400 font-semibold"
                    style={{ fontSize: 13, textDecoration: 'none' }}
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

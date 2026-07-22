'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';

export default function EventList({ events, showFilters = true }: { events: any[], showFilters?: boolean }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase());
      const matchesCat = category === 'All' || (e.category && e.category === category);
      return matchesSearch && matchesCat;
    });
  }, [search, category, events]);

  return (
    <div>
      {showFilters && (
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Search events, venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: 8, background: "#1f1f1f", border: "1px solid #333", color: "#fff", marginBottom: 16 }}
          />
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
            {["All", "Concert", "Festival", "Comedy", "Autoshow", "Sports", "Other"].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: "8px 16px", borderRadius: 20, cursor: 'pointer',
                  background: category === cat ? 'linear-gradient(to right, #4f46e5, #06b6d4)' : '#1f1f1f',
                  color: category === cat ? '#fff' : '#ccc',
                  border: category === cat ? 'none' : '1px solid #333', whiteSpace: "nowrap",
                  fontWeight: category === cat ? 700 : 500
                }}
              >{cat}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {filteredEvents.map((e: any) => {
          const eventDate = new Date(e.start_at);
          const isPastEvent = e.end_at ? new Date(e.end_at) < new Date() : eventDate < new Date();
          const isCancelled = e.status === 'cancelled';
          const capacity = Number(e.total_capacity) || 0;
          const sold = Number(e.total_sold) || 0;
          const isSoldOut = capacity > 0 && sold >= capacity;
          const percentSold = capacity > 0 ? Math.floor((sold / capacity) * 100) : 0;
          const isAlmostSoldOut = capacity > 0 && !isSoldOut && percentSold >= 90;

          return (
            <div key={e.id} style={{ position: 'relative', background: '#121212', borderRadius: 12, overflow: 'hidden', border: '1px solid #1f1f1f', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ position: 'relative', height: 180, background: '#1a1a1a' }}>
                {e.cover_image_url && <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {isCancelled ? (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: '#7f1d1d', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>CANCELLED</div>
                ) : isPastEvent ? (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: '#4b5563', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>ENDED</div>
                ) : isSoldOut ? (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: '#dc2626', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>SOLD OUT</div>
                ) : isAlmostSoldOut ? (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: '#d97706', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{percentSold}% SOLD</div>
                ) : null}
              </div>
              <div style={{ padding: 16 }}>
                <h3 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ fontSize: 17, marginBottom: 8 }}>{e.title}</h3>
                <p className="text-gray-400 text-xs mb-1">
                  {e.start_at ? eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
                </p>
                <p className="text-gray-400 text-xs mb-3">{e.venue_name || 'Venue TBD'}</p>
                <Link href={`/events/${e.slug}`} className="text-indigo-400 hover:text-cyan-400 font-semibold" style={{ fontSize: 13, textDecoration: 'none' }}>View Details &rarr;</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

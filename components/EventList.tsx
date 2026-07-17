'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';

export default function EventList({ events }: { events: any[] }) {
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
      {/* Search and Categories */}
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
                background: category === cat ? '#fff' : '#1f1f1f', 
                color: category === cat ? '#000' : '#fff',
                border: "1px solid #333", whiteSpace: "nowrap" 
              }}
            >{cat}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {filteredEvents.map((e: any) => {
          const eventDate = new Date(e.start_at);
          const isPastEvent = eventDate < new Date();
          const capacity = Number(e.total_capacity) || 0;
          const sold = Number(e.total_sold) || 0;
          const isSoldOut = capacity > 0 && sold >= capacity;

          return (
            <div key={e.id} style={{ position: 'relative', background: '#121212', borderRadius: 12, overflow: 'hidden', border: '1px solid #1f1f1f' }}>
              <div style={{ position: 'relative', height: 180 }}>
                {e.cover_image_url && <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {isPastEvent ? (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: '#4b5563', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>ENDED</div>
                ) : isSoldOut ? (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: '#dc2626', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>SOLD OUT</div>
                ) : null}
              </div>
              <div style={{ padding: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{e.title}</h3>
                <Link href={`/events/${e.slug}`} style={{ color: '#10b981', fontSize: 13 }}>View Details</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

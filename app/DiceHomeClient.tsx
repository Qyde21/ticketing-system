'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Event {
  id: string;
  title: string;
  slug: string;
  venue_name: string;
  start_at: string;
  cover_image_url: string | null;
  category: string | null;
  min_price: number | null;
  total_capacity: number;
  total_sold: number;
}

const CATEGORIES = ['All', 'Concert', 'Festival', 'Comedy', 'Autoshow', 'Sports', 'Other'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getRemaining(capacity: number, sold: number) {
  return Math.max(0, capacity - sold);
}

function isSoldOut(capacity: number, sold: number) {
  return capacity > 0 && sold >= capacity;
}

function isSellingFast(capacity: number, sold: number) {
  return capacity > 0 && (sold / capacity) >= 0.8 && sold < capacity;
}

export default function DiceHomeClient({ events }: { events: Event[] }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = events.filter((e) => {
    const matchesQuery = e.title.toLowerCase().includes(query.toLowerCase()) ||
      e.venue_name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === 'All' || e.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>

      {/* Hero */}
      {featured && (
        <Link href={'/events/' + featured.slug} style={{ display: 'block', position: 'relative', height: 480, overflow: 'hidden', textDecoration: 'none' }}>
          {featured.cover_image_url ? (
            <img src={featured.cover_image_url} alt={featured.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />

          <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '2rem', maxWidth: 600 }}>
            {featured.category && (
              <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                {featured.category}
              </span>
            )}
            <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: '#fff', margin: '0 0 8px', lineHeight: 1.1 }}>{featured.title}</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, margin: '0 0 16px' }}>
              {formatDate(featured.start_at)} · {featured.venue_name}
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {featured.min_price && (
                <span style={{ background: '#fff', color: '#000', padding: '8px 20px', borderRadius: 99, fontWeight: 800, fontSize: 15 }}>
                  From KES {Number(featured.min_price).toLocaleString()}
                </span>
              )}
              {isSellingFast(featured.total_capacity, featured.total_sold) && (
                <span style={{ color: '#ff6b35', fontWeight: 700, fontSize: 14 }}>🔥 Selling fast</span>
              )}
              {isSoldOut(featured.total_capacity, featured.total_sold) && (
                <span style={{ color: '#ff4444', fontWeight: 700, fontSize: 14 }}>Sold out</span>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Search + Filter */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 0' }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, venues..."
            style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, width: '100%' }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 28 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 16px',
                borderRadius: 99,
                border: activeCategory === cat ? 'none' : '1px solid rgba(255,255,255,0.2)',
                background: activeCategory === cat ? '#fff' : 'transparent',
                color: activeCategory === cat ? '#000' : 'rgba(255,255,255,0.7)',
                fontWeight: activeCategory === cat ? 700 : 400,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Section title */}
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''} {activeCategory !== 'All' ? 'in ' + activeCategory : 'coming up'}
        </p>

        {/* Event grid */}
        {filtered.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '3rem 0' }}>No events found.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, paddingBottom: 48 }}>
            {filtered.map((e) => {
              const soldOut = isSoldOut(e.total_capacity, e.total_sold);
              const sellingFast = isSellingFast(e.total_capacity, e.total_sold);
              return (
                <Link key={e.id} href={'/events/' + e.slug} style={{ textDecoration: 'none', display: 'block', borderRadius: 12, overflow: 'hidden', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', transition: 'transform 0.2s, border-color 0.2s' }}
                  onMouseEnter={(el) => { (el.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (el.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                  onMouseLeave={(el) => { (el.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (el.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  {/* Card image */}
                  <div style={{ position: 'relative', height: 200, background: '#222', overflow: 'hidden' }}>
                    {e.cover_image_url ? (
                      <img src={e.cover_image_url} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 600, textAlign: 'center', padding: '0 16px' }}>{e.title}</span>
                      </div>
                    )}
                    {/* Date badge */}
                    <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>
                      {formatDate(e.start_at)}
                    </div>
                    {/* Status badges */}
                    {soldOut && (
                      <div style={{ position: 'absolute', top: 10, right: 10, background: '#ff4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                        Sold out
                      </div>
                    )}
                    {sellingFast && !soldOut && (
                      <div style={{ position: 'absolute', top: 10, right: 10, background: '#ff6b35', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6 }}>
                        🔥 Selling fast
                      </div>
                    )}
                    {e.category && (
                      <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {e.category}
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '14px 14px 16px' }}>
                    <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: '0 0 4px', lineHeight: 1.3 }}>{e.title}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 10px' }}>{e.venue_name}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                        {e.min_price ? 'KES ' + Number(e.min_price).toLocaleString() : 'Free'}
                      </span>
                      <span style={{ background: soldOut ? '#333' : 'rgba(255,255,255,0.1)', color: soldOut ? 'rgba(255,255,255,0.3)' : '#fff', padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                        {soldOut ? 'Sold out' : 'Get tickets'}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
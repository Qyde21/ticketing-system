import { sql } from '@/lib/db';
import Link from 'next/link';
import HomeSearch from './HomeSearch';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const events = await sql`
    SELECT e.id, e.title, e.slug, e.venue_name, e.start_at, e.cover_image_url,
           MIN(tt.price_kes) AS min_price
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.status = 'published'
    GROUP BY e.id
    ORDER BY e.start_at ASC
  `;

  const featured = events[0];
  const rest = events.slice(1);

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Hero */}
      {featured && (
        <Link href={`/events/${featured.slug}`} className="block relative h-[420px] w-full overflow-hidden bg-neutral-900">
          {featured.cover_image_url ? (
            <img
              src={featured.cover_image_url}
              alt={featured.title}
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 to-purple-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-10 text-white">
            <span className="inline-block bg-amber-400 text-black text-xs font-bold px-3 py-1 rounded-full mb-3">
              {new Date(featured.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight max-w-2xl">{featured.title}</h1>
            <p className="mt-2 text-neutral-200">{featured.venue_name}</p>
            {featured.min_price && (
              <p className="mt-3 inline-block bg-white/10 backdrop-blur px-4 py-2 rounded-lg font-semibold">
                From KES {Number(featured.min_price).toLocaleString()}
              </p>
            )}
          </div>
        </Link>
      )}

      {/* Search */}
      <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-10">
        <HomeSearch />
      </div>

      {/* Event grid */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-center text-xl md:text-2xl font-extrabold tracking-wide text-neutral-800 mb-8">
          EVENTS ON TICKETHUB
        </h2>

        {events.length === 0 ? (
          <p className="text-center text-neutral-500">No events published yet. Check back soon.</p>
        ) : (
          <div id="event-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((e: any) => (
              <Link
                key={e.id}
                href={`/events/${e.slug}`}
                data-title={e.title.toLowerCase()}
                className="event-card group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-neutral-100"
              >
                <div className="relative h-44 w-full bg-neutral-200 overflow-hidden">
                  {e.cover_image_url ? (
                    <img
                      src={e.cover_image_url}
                      alt={e.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg px-4 text-center">
                      {e.title}
                    </div>
                  )}
                  <span className="absolute top-3 left-3 bg-white text-neutral-800 text-xs font-bold px-2 py-1 rounded shadow">
                    {new Date(e.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-neutral-900 truncate">{e.title}</h3>
                  <p className="text-sm text-neutral-500 mt-1 truncate">{e.venue_name}</p>
                  <p className="text-sm font-semibold text-indigo-600 mt-2">
                    {e.min_price ? `KES ${Number(e.min_price).toLocaleString()}` : 'Free'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
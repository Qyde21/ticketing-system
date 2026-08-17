import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import FavoriteButton from '@/components/FavoriteButton';

export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const session = await getSession();
  if (!session?.userId) {
    redirect('/login?next=/favorites');
  }

  let events: any[] = [];
  let setupError = '';
  try {
    events = await sql`
      SELECT
        e.id, e.title, e.slug, e.venue_name, e.start_at, e.end_at, e.status,
        e.cover_image_url, e.category,
        f.created_at AS saved_at
      FROM event_favorites f
      JOIN events e ON e.id = f.event_id
      WHERE f.user_id = ${session.userId}
      ORDER BY f.created_at DESC
    `;
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('event_favorites') || msg.includes('does not exist')) {
      setupError = 'Run migrations/008_event_favorites.sql on the database first.';
    } else {
      setupError = 'Could not load saved events.';
      console.error(err);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-white">
      <h1 className="text-2xl font-extrabold mb-1">Saved events</h1>
      <p className="text-gray-400 text-sm mb-6">Your wishlist — events you have hearted for later.</p>

      {setupError && (
        <div className="bg-amber-950/40 border border-amber-800/60 text-amber-200 text-sm rounded-xl px-4 py-3 mb-4">
          {setupError}
        </div>
      )}

      {!setupError && events.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-4">No saved events yet.</p>
          <Link href="/" className="text-indigo-400 hover:underline font-semibold text-sm">
            Browse events →
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {events.map((e) => {
          const ended =
            e.status === 'cancelled' ||
            (e.end_at ? new Date(e.end_at) < new Date() : e.start_at && new Date(e.start_at) < new Date());
          return (
            <li
              key={e.id}
              className="flex gap-3 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
            >
              <Link href={`/events/${e.slug || e.id}`} className="w-28 h-24 shrink-0 bg-gray-800 block">
                {e.cover_image_url ? (
                  <img src={e.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </Link>
              <div className="flex-1 py-3 pr-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/events/${e.slug || e.id}`}
                      className="font-semibold text-white hover:text-indigo-300 line-clamp-2"
                    >
                      {e.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {e.start_at ? new Date(e.start_at).toLocaleString() : 'Date TBA'}
                      {e.venue_name ? ` · ${e.venue_name}` : ''}
                    </p>
                    {ended && (
                      <p className="text-xs text-amber-400 mt-1">
                        {e.status === 'cancelled' ? 'Cancelled' : 'Event ended'}
                      </p>
                    )}
                  </div>
                  <FavoriteButton eventId={e.id} initialFavorited size="sm" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
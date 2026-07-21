import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PublishButton from '../PublishButton';
import CancelEventButton from '../CancelEventButton';

export const dynamic = 'force-dynamic';

export default async function OrganizerDashboard() {
  const session = await getSession();
  const events = await sql`
    SELECT id, title, slug, status, start_at, cover_image_url
    FROM events
    WHERE organizer_id = ${session!.userId}
    AND status != 'cancelled'
    ORDER BY created_at DESC
  `;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Your Events</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your created events, track ticket sales, and monitor check-ins</p>
        </div>
        <Link
          href="/organizer/events/new"
          className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold px-5 py-2.5 rounded-lg transition shadow-lg"
        >
          + Create New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl">
          <p className="text-gray-400 mb-4">You haven't created any events yet.</p>
          <Link
            href="/organizer/events/new"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-lg transition shadow"
          >
            Create Your First Event
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((e: any) => (
            <div
              key={e.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition hover:border-gray-700"
            >
              <div className="flex items-center gap-5 w-full md:w-auto">
                <div className="w-24 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 border border-gray-700 relative">
                  {e.cover_image_url ? (
                    <img src={e.cover_image_url} alt={e.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-gray-500 text-center p-2">
                      {e.title}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{e.title}</h2>
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                      e.status === 'published' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Date: {e.start_at ? new Date(e.start_at).toLocaleDateString() : 'TBD'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-gray-800 w-full md:w-auto justify-end">
                {e.status === 'draft' && <PublishButton eventId={e.id} />}
                
                {e.status === 'published' && (
                  <>
                    <Link
                      href={`/scan/${e.id}`}
                      className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow"
                    >
                      Scan Tickets
                    </Link>
                    <Link
                      href={`/organizer/events/${e.id}/scan-overview`}
                      className="bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow"
                    >
                      Scan Overview
                    </Link>
                  </>
                )}

                <Link
                  href={`/organizer/events/${e.id}/orders`}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow"
                >
                  Orders
                </Link>

                <Link
                  href={`/organizer/events/${e.id}/messages`}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow"
                >
                  Messages
                </Link>

                <Link
                  href={`/organizer/events/${e.id}/edit`}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow"
                >
                  Edit Cover
                </Link>

                {(e.status === 'draft' || e.status === 'published') && (
                  <CancelEventButton eventId={e.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
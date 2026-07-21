import { sql } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const events = await sql`
    SELECT e.*, u.full_name as organizer_name, u.email as organizer_email
    FROM events e
    LEFT JOIN users u ON u.id = e.organizer_id
    ORDER BY e.created_at DESC
  `;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Manage Events</h1>
          <p className="text-gray-400 text-sm mt-1">Overview and management of all platform events</p>
        </div>
        <Link
          href="/admin/events/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow text-sm"
        >
          + Create New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm mb-4">No events found on the platform.</p>
          <Link
            href="/admin/events/new"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            Create Your First Event
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event: any) => (
            <div 
              key={event.id} 
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-gray-700 transition"
            >
              <div className="flex items-start gap-4">
                {event.image_url ? (
                  <img 
                    src={event.image_url} 
                    alt={event.title} 
                    className="w-20 h-20 object-cover rounded-lg border border-gray-800 shrink-0" 
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-gray-500 text-xs shrink-0">
                    No Image
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{event.title}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                      event.status === 'published' 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                        : event.status === 'completed' 
                        ? 'bg-blue-950 text-blue-400 border border-blue-800' 
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {event.status || 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Organizer: <strong className="text-gray-300">{event.organizer_name || event.organizer_email || 'Platform Admin'}</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Created: {event.created_at ? new Date(event.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-gray-800">
                <Link
                  href={`/events/${event.slug || event.id}`}
                  className="bg-gray-800 hover:bg-gray-700 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded border border-gray-700 transition"
                >
                  View Page
                </Link>
                <Link
                  href={`/admin/events/${event.id}/scan`}
                  className="bg-gray-800 hover:bg-gray-700 text-cyan-300 text-xs font-medium px-3 py-1.5 rounded border border-gray-700 transition"
                >
                  Scan Tickets
                </Link>
                <Link
                  href={`/admin/events/${event.id}/orders`}
                  className="bg-gray-800 hover:bg-gray-700 text-emerald-300 text-xs font-medium px-3 py-1.5 rounded border border-gray-700 transition"
                >
                  Orders
                </Link>
                <Link
                  href={`/admin/events/${event.id}/edit`}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded transition shadow"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

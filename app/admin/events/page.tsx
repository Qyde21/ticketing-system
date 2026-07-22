import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage({ searchParams }: { searchParams: { organizer_id?: string } | Promise<{ organizer_id?: string }> }) {
  const session = await getSession();
  const resolvedParams = await Promise.resolve(searchParams);
  const organizerId = resolvedParams?.organizer_id;

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized access.</div>;
  }

  let events: any[] = [];
  let organizerName = '';

  try {
    if (organizerId) {
      // Fetch events matching this organizer_id explicitly using full_name
      events = await sql`
        SELECT e.*, u.email as organizer_email, COALESCE(u.full_name, 'Organizer') as organizer_name 
        FROM events e 
        LEFT JOIN users u ON u.id::text = e.organizer_id::text 
        WHERE e.organizer_id::text = ${organizerId}
        ORDER BY e.created_at DESC
      `;

      if (events.length > 0) {
        organizerName = events[0].organizer_name || events[0].organizer_email;
      } else {
        const userRes = await sql`SELECT full_name, email FROM users WHERE id::text = ${organizerId}`;
        if (userRes.length > 0) {
          organizerName = userRes[0].full_name || userRes[0].email;
        }
      }
    } else {
      events = await sql`
        SELECT e.*, u.email as organizer_email, COALESCE(u.full_name, 'Organizer') as organizer_name 
        FROM events e 
        LEFT JOIN users u ON u.id::text = e.organizer_id::text 
        ORDER BY e.created_at DESC
      `;
    }
  } catch (err) {
    console.error("Error loading admin events:", err);
    events = [];
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            {organizerName ? `Events Hosted by ${organizerName}` : 'All System Events'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {organizerId ? `Showing filtered events for this specific organizer.` : 'Manage and review all platform events'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {organizerId && (
            <Link 
              href="/admin/organizers" 
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
            >
              ← Back to Organizers
            </Link>
          )}
          <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-xl text-sm text-gray-300 shadow">
            Total Events: <strong className="text-cyan-400">{events.length}</strong>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No events found for this organizer.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev: any) => (
            <div key={ev.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white line-clamp-1">{ev.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    ev.status === 'published' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-yellow-950 text-yellow-400 border border-yellow-800'
                  }`}>
                    {ev.status || 'draft'}
                  </span>
                </div>
                <p className="text-xs text-indigo-300 mb-2">Organizer: {ev.organizer_name || ev.organizer_email || 'Unknown'}</p>
                <p className="text-xs text-gray-400 line-clamp-2">{ev.description}</p>
              </div>

              <div className="pt-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
                <span>{ev.start_at ? new Date(ev.start_at).toLocaleDateString() : 'Date TBD'}</span>
                <Link 
                  href={`/events/${ev.id}`} 
                  target="_blank"
                  className="text-cyan-400 hover:underline font-semibold"
                >
                  View Live →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
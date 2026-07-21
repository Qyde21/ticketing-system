import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizersPage() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized access.</div>;
  }

  // Fetch organizers with event counts using valid SQL syntax
  const organizers = await sql`
    SELECT u.id, u.name, u.email, u.created_at, u.status,
    (SELECT COUNT(*) FROM events e WHERE e.organizer_id = u.id) as total_events,
    (SELECT COUNT(*) FROM events e WHERE e.organizer_id = u.id AND e.status = 'published') as published_events
    FROM users u
    WHERE u.role = 'organizer' OR u.id IN (SELECT DISTINCT organizer_id FROM events WHERE organizer_id IS NOT NULL)
    ORDER BY u.created_at DESC
  `;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Organizer Management</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor registered organizers, verify accounts, and inspect hosted events</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-xl text-sm text-gray-300 shadow">
          Total Organizers: <strong className="text-cyan-400">{organizers.length}</strong>
        </div>
      </div>

      {organizers.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No organizers found in the system.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {organizers.map((org: any) => (
            <div 
              key={org.id} 
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6 transition hover:border-gray-700"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white">{org.name || 'Unnamed Organizer'}</h2>
                    <p className="text-indigo-300 text-sm">{org.email}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                    org.status === 'suspended' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-green-950 text-green-400 border border-green-800'
                  }`}>
                    {org.status || 'Active'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-800/80">
                  <span>Joined: <strong className="text-gray-300">{new Date(org.created_at).toLocaleDateString()}</strong></span>
                  <span>•</span>
                  <span>Events: <strong className="text-cyan-400">{org.total_events}</strong> ({org.published_events} published)</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <Link
                  href={`/admin/events?organizer_id=${org.id}`}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-lg shadow-indigo-950/50"
                >
                  View Events
                </Link>

                <button 
                  onClick={() => alert('Organizer status toggling can be connected to your backend action.')}
                  className="bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 border border-gray-700 font-semibold px-3 py-2 rounded-xl text-xs transition"
                >
                  {org.status === 'suspended' ? 'Activate Account' : 'Suspend Organizer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
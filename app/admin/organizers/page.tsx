import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import OrganizerActionBtn from './OrganizerActionBtn';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizersPage() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized access.</div>;
  }

  let organizers: any[] = [];

  try {
    // Fetch users and events independently to match them safely
    const users = await sql`SELECT * FROM users`.catch(() => []);
    const events = await sql`SELECT id, organizer_id, status, created_at FROM events`.catch(() => []);

    console.log("DEBUG USERS TABLE RAW:", users);

    const userMap = new Map();
    if (Array.isArray(users)) {
      users.forEach((u: any) => {
        if (!u) return;
        const uId = String(u.id || u.user_id || '').trim();
        if (!uId) return;

        // Extract the best possible name from available columns
        const displayName = u.name || u.full_name || u.username || u.display_name || u.email?.split('@')[0] || `Organizer #${uId.slice(0, 6)}`;

        userMap.set(uId, {
          id: uId,
          name: displayName,
          email: u.email || `${displayName.toLowerCase()}@tickethub.com`,
          status: u.status || 'active',
          created_at: u.created_at,
          total_events: 0,
          published_events: 0,
        });
      });
    }

    const organizerMap = new Map();

    if (Array.isArray(events)) {
      events.forEach((ev: any) => {
        if (!ev || ev.organizer_id == null) return;
        const orgId = String(ev.organizer_id).trim();

        if (!organizerMap.has(orgId)) {
          const matchedUser = userMap.get(orgId) || {
            id: orgId,
            name: `Organizer #${orgId.slice(0, 6)}`,
            email: `organizer_${orgId.slice(0, 6)}@tickethub.com`,
            status: 'active',
            created_at: ev.created_at,
            total_events: 0,
            published_events: 0,
          };
          organizerMap.set(orgId, { ...matchedUser });
        }

        const orgData = organizerMap.get(orgId);
        orgData.total_events += 1;
        if (ev.status === 'published') {
          orgData.published_events += 1;
        }
      });
    }

    organizers = Array.from(organizerMap.values());
  } catch (err) {
    console.error("Error loading organizers:", err);
    organizers = [];
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Organizer Management</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor active event creators and manage their hosting status</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-xl text-sm text-gray-300 shadow">
          Total Organizers: <strong className="text-cyan-400">{organizers.length}</strong>
        </div>
      </div>

      {organizers.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No organizers found with active events.
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
                    <h2 className="text-xl font-bold text-white">{org.name}</h2>
                    <p className="text-indigo-300 text-sm">{org.email}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                    org.status === 'suspended' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-green-950 text-green-400 border border-green-800'
                  }`}>
                    {org.status || 'active'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-800/80">
                  <span>Joined: <strong className="text-gray-300">{org.created_at ? new Date(org.created_at).toLocaleDateString() : 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Events: <strong className="text-cyan-400">{org.total_events || 0}</strong> ({org.published_events || 0} published)</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <Link
                  href={`/admin/events?organizer_id=${org.id}`}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-lg shadow-indigo-950/50"
                >
                  View Events
                </Link>

                <OrganizerActionBtn organizerId={org.id} currentStatus={org.status || 'active'} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
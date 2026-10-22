import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import OrganizerActionBtn from './OrganizerActionBtn';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizersPage() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-black">Unauthorized access.</div>;
  }

  const organizers = await sql`
    SELECT
      u.id,
      COALESCE(op.business_name, u.full_name) AS name,
      u.email,
      u.status,
      u.created_at,
      COALESCE(op.is_verified, false) AS is_verified,
      COUNT(e.id) AS total_events,
      COUNT(e.id) FILTER (WHERE e.status = 'published') AS published_events
    FROM users u
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    LEFT JOIN events e ON e.organizer_id = u.id
    WHERE u.role = 'organizer'
    GROUP BY u.id, op.business_name, op.is_verified
    ORDER BY op.is_verified ASC, u.created_at DESC
  `;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-black">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-black/10">
        <div>
          <h1 className="text-3xl font-extrabold text-black">Organizer Management</h1>
      <p className="text-sm text-neutral-500 mb-4">Open an organizer → add <code className="text-amber-600">/support</code> to the URL for read-only support view, or use Support links on event rows once listed.</p>
          <p className="text-neutral-500 text-sm mt-1">Monitor event creators and manage their hosting status</p>
        </div>
        <div className="bg-white border border-black/10 px-4 py-2 rounded-xl text-sm text-neutral-700 shadow">
          Total Organizers: <strong className="text-cyan-400">{organizers.length}</strong>
        </div>
      </div>

      {organizers.length === 0 ? (
        <div className="text-center py-16 bg-white border border-black/10 rounded-2xl shadow-xl text-neutral-500">
          No organizers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {organizers.map((org: any) => (
            <div
              key={org.id}
              className="bg-white border border-black/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6 transition hover:border-black/15"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-black">{org.name}</h2>
                    <p className="text-indigo-300 text-sm">{org.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {!org.is_verified && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
                        Pending Approval
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                      org.status === 'suspended' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'
                    }`}>
                      {org.status || 'active'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-neutral-500 pt-2 border-t border-black/10">
                  <span>Joined: <strong className="text-neutral-700">{org.created_at ? new Date(org.created_at).toLocaleDateString() : 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Events: <strong className="text-cyan-400">{org.total_events || 0}</strong> ({org.published_events || 0} published)</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/10">
                <Link
                  href={`/admin/events?organizer_id=${org.id}`}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-lg shadow-indigo-950/50"
                >
                  View Events
                </Link>

                <OrganizerActionBtn organizerId={org.id} currentStatus={org.status || 'active'} isVerified={org.is_verified} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

import { sql } from '@/lib/db';
import Link from 'next/link';
import ApproveButton from './ApproveButton';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'organizer') AS total_organizers,
      (SELECT COUNT(*) FROM events) AS total_events,
      (SELECT COUNT(*) FROM events WHERE status = 'published') AS published_events,
      (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS paid_orders,
      (SELECT COALESCE(SUM(total_amount_kes), 0) FROM orders WHERE payment_status = 'paid') AS total_revenue_kes
  `;

  const pendingOrganizers = await sql`
    SELECT u.id, u.full_name, u.email, op.business_name, op.created_at
    FROM organizer_profiles op
    JOIN users u ON u.id = op.user_id
    WHERE op.is_verified = false
    ORDER BY op.created_at ASC
  `;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Platform overview and management controls</p>
        </div>
        <Link
          href="/admin/events"
          className="bg-gray-800 hover:bg-gray-700 text-indigo-300 font-semibold px-4 py-2 rounded-lg border border-gray-700 transition shadow"
        >
          Manage All Events &rarr;
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Revenue</p>
          <p className="text-2xl font-extrabold text-white mt-2">KES {Number(stats.total_revenue_kes).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.paid_orders} successful paid orders</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Events</p>
          <p className="text-2xl font-extrabold text-white mt-2">{stats.total_events}</p>
          <p className="text-xs text-cyan-400 mt-1">{stats.published_events} currently published</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Users</p>
          <p className="text-2xl font-extrabold text-white mt-2">{stats.total_users}</p>
          <p className="text-xs text-gray-400 mt-1">Registered platform accounts</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Organizers</p>
          <p className="text-2xl font-extrabold text-white mt-2">{stats.total_organizers}</p>
          <p className="text-xs text-gray-400 mt-1">Active event organizers</p>
        </div>
      </div>

      {/* Pending Organizer Approvals Section */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">
            Pending Organizer Approvals ({pendingOrganizers.length})
          </h2>
        </div>

        {pendingOrganizers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-800/40 rounded-lg border border-gray-800">
            No pending organizer approvals at the moment. All clear!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-indigo-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Business Name</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Requested On</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {pendingOrganizers.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-800/50 transition">
                    <td className="py-4 px-4 font-semibold text-white">{o.business_name || 'N/A'}</td>
                    <td className="py-4 px-4 text-gray-300">{o.full_name}</td>
                    <td className="py-4 px-4 text-gray-400">{o.email}</td>
                    <td className="py-4 px-4 text-gray-400">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-4 text-right">
                      <ApproveButton userId={o.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
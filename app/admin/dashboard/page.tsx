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

  const events = await sql`
    SELECT e.id, e.title, e.slug, e.status, e.created_at
    FROM events e
    ORDER BY e.created_at DESC
  `;

  const eventAnalytics = await Promise.all(
    events.map(async (event: any) => {
      const ticketTypes = await sql`
        SELECT id, name, price_kes, quantity_total, quantity_sold 
        FROM ticket_types 
        WHERE event_id = ${event.id}
      `;

      let totalCapacity = 0;
      let totalSold = 0;
      let eventRevenue = 0;

      const tiers = ticketTypes.map((t: any) => {
        const total = Number(t.quantity_total) || 0;
        const sold = Number(t.quantity_sold) || 0;
        const price = Number(t.price_kes || 0);

        totalCapacity += total;
        totalSold += sold;
        eventRevenue += sold * price;

        return { ...t, total, sold, remaining: Math.max(0, total - sold), price };
      });

      return {
        ...event,
        totalCapacity,
        totalSold,
        eventRevenue,
        tiers,
      };
    })
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Platform overview and management controls</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/events/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow text-sm"
          >
            + Create Event
          </Link>
          <Link
            href="/admin/events"
            className="bg-gray-800 hover:bg-gray-700 text-indigo-300 font-semibold px-4 py-2 rounded-lg border border-gray-700 transition shadow text-sm"
          >
            Manage All Events &rarr;
          </Link>
        </div>
      </div>

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

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">
            Events & Ticket Inventory Analytics
          </h2>
          <span className="text-xs text-gray-400">Real-time status breakdown</span>
        </div>

        {eventAnalytics.length > 0 ? (
          <div className="space-y-6">
            {eventAnalytics.map((ev) => (
              <div key={ev.id} className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-3 border-b border-gray-800">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{ev.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${ev.status === 'published' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                        {ev.status || 'Draft'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Created: {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="text-sm font-bold text-cyan-400">KES {ev.eventRevenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Tickets Sold</p>
                      <p className="text-sm font-bold text-emerald-400">{ev.totalSold} / {ev.totalCapacity}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 pb-3 mb-3 border-b border-gray-800/60 text-xs">
                  <Link
                    href={`/admin/events/${ev.id}/scan`}
                    className="text-gray-300 hover:text-emerald-400 transition"
                  >
                    Scan tickets
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/admin/events/${ev.id}/scan-overview`}
                    className="text-gray-300 hover:text-cyan-400 transition"
                  >
                    Scan overview
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/admin/events/${ev.id}/orders`}
                    className="text-gray-300 hover:text-indigo-400 transition"
                  >
                    Orders
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/admin/events/${ev.id}/messages`}
                    className="text-gray-300 hover:text-purple-400 transition"
                  >
                    Messages
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/admin/events/${ev.id}/edit-cover`}
                    className="text-gray-300 hover:text-amber-400 transition"
                  >
                    Edit cover
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/admin/events/${ev.id}/cancel`}
                    className="text-orange-400 hover:text-orange-300 transition"
                  >
                    Cancel event
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/admin/events/${ev.id}/delete`}
                    className="text-red-400 hover:text-red-300 transition"
                  >
                    Delete event
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ev.tiers.map((tier: any) => (
                    <div key={tier.id} className="bg-gray-900 p-3 rounded border border-gray-800 text-xs">
                      <div className="flex justify-between font-semibold text-gray-200">
                        <span>{tier.name}</span>
                        <span className="text-cyan-400">KES {tier.price.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-gray-400">
                        <span>Sold: <strong className="text-emerald-400">{tier.sold}</strong></span>
                        <span>Remaining: <strong className="text-amber-400">{tier.remaining}</strong></span>
                        <span>Total: {tier.total}</span>
                      </div>
                      <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-2">
                        <div 
                          className="bg-indigo-500 h-full" 
                          style={{ width: `${tier.total > 0 ? Math.round((tier.sold / tier.total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 bg-gray-800/40 rounded-lg border border-gray-800">
            No events found on the platform.
          </div>
        )}
      </section>

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

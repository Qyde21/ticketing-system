import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import ApproveButton from './ApproveButton';
import AdminEventActions from '../events/AdminEventActions';
import EventApprovalActions from './EventApprovalActions';
import SalesTrendChart from '@/components/SalesTrendChart';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-black">Unauthorized access.</div>;
  }

  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'organizer') AS total_organizers,
      (SELECT COUNT(*) FROM events) AS total_events,
      (SELECT COUNT(*) FROM events WHERE status = 'published') AS published_events,
      (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS paid_orders,
      (SELECT COALESCE(SUM(total_amount_kes), 0) FROM orders WHERE payment_status = 'paid') AS total_revenue_kes
  `;

  const topOrganizers = await sql`
    SELECT
      u.id,
      u.full_name,
      op.business_name,
      COUNT(DISTINCT e.id)::int AS event_count,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS revenue_kes,
      COALESCE(SUM(o.quantity) FILTER (WHERE o.payment_status = 'paid'), 0)::int AS tickets_sold
    FROM users u
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    LEFT JOIN events e ON e.organizer_id = u.id
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE u.role = 'organizer'
    GROUP BY u.id, u.full_name, op.business_name
    ORDER BY revenue_kes DESC
    LIMIT 5
  `;

  const platformOrders = await sql`
    SELECT created_at, total_amount_kes, payment_status, quantity
    FROM orders
    ORDER BY created_at ASC
  `;

  
  const [risk] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM orders WHERE payment_status = 'pending' AND created_at > now() - interval '24 hours') AS pending_24h,
      (SELECT COUNT(*)::int FROM orders WHERE payment_status = 'pending' AND created_at < now() - interval '30 minutes') AS pending_stale,
      (SELECT COUNT(*)::int FROM orders WHERE payment_status = 'paid' AND created_at > now() - interval '1 hour') AS paid_1h,
      (SELECT COUNT(*)::int FROM orders WHERE payment_status = 'refunded' AND created_at > now() - interval '24 hours') AS refunded_24h
  `;
  const pendingOrganizers = await sql`
    SELECT u.id, u.full_name, u.email, op.business_name, op.created_at
    FROM organizer_profiles op
    JOIN users u ON u.id = op.user_id
    WHERE op.is_verified = false
    ORDER BY op.created_at ASC
  `;

  const pendingEvents = await sql`
    SELECT e.id, e.title, e.start_at, e.venue_name, e.updated_at,
           u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.status = 'pending_review'
    ORDER BY e.updated_at ASC
  `;

  const events = await sql`
    SELECT e.id, e.title, e.slug, e.status, e.created_at, e.start_at, e.end_at, e.start_at, e.end_at
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
    <main className="max-w-6xl mx-auto px-4 py-8 text-black">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-black/10">
        <div>
          <h1 className="text-3xl font-extrabold text-black">Admin Dashboard</h1>
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <Link href="/admin/orders" className="text-indigo-400 hover:underline">Order search</Link>
        <Link href="/admin/audit" className="text-indigo-400 hover:underline">Audit log</Link>
        <Link href="/admin/payouts" className="text-indigo-400 hover:underline">Payouts</Link>
        <Link href="/admin/organizers" className="text-indigo-400 hover:underline">Organizers</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-white border border-black/10 rounded-xl p-3">
          <p className="text-xs text-neutral-500">Pending (24h)</p>
          <p className="text-xl font-bold text-amber-600">{Number(risk?.pending_24h ?? 0)}</p>
        </div>
        <div className="bg-white border border-black/10 rounded-xl p-3">
          <p className="text-xs text-neutral-500">Stale pending (&gt;30m)</p>
          <p className="text-xl font-bold text-red-600">{Number(risk?.pending_stale ?? 0)}</p>
        </div>
        <div className="bg-white border border-black/10 rounded-xl p-3">
          <p className="text-xs text-neutral-500">Paid (1h)</p>
          <p className="text-xl font-bold text-emerald-600">{Number(risk?.paid_1h ?? 0)}</p>
        </div>
        <div className="bg-white border border-black/10 rounded-xl p-3">
          <p className="text-xs text-neutral-500">Refunded (24h)</p>
          <p className="text-xl font-bold text-cyan-400">{Number(risk?.refunded_24h ?? 0)}</p>
        </div>
      </div>
          <p className="text-neutral-500 text-sm mt-1">Platform overview and management controls</p>
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
            className="bg-neutral-100 hover:bg-neutral-200 text-indigo-300 font-semibold px-4 py-2 rounded-lg border border-black/15 transition shadow text-sm"
          >
            Manage All Events &rarr;
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white border border-black/10 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Revenue</p>
          <p className="text-2xl font-extrabold text-black mt-2">KES {Number(stats.total_revenue_kes).toLocaleString()}</p>
          <p className="text-xs text-neutral-500 mt-1">{stats.paid_orders} successful paid orders</p>
        </div>

        <div className="bg-white border border-black/10 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Events</p>
          <p className="text-2xl font-extrabold text-black mt-2">{stats.total_events}</p>
          <p className="text-xs text-cyan-400 mt-1">{stats.published_events} currently published</p>
        </div>

        <div className="bg-white border border-black/10 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Users</p>
          <p className="text-2xl font-extrabold text-black mt-2">{stats.total_users}</p>
          <p className="text-xs text-neutral-500 mt-1">Registered platform accounts</p>
        </div>

        <div className="bg-white border border-black/10 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Organizers</p>
          <p className="text-2xl font-extrabold text-black mt-2">{stats.total_organizers}</p>
          <p className="text-xs text-neutral-500 mt-1">Active event organizers</p>
        </div>
      </div>

      <section className="bg-white border border-black/10 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">Platform Sales Trend</h2>
          <span className="text-xs text-neutral-500">All events combined</span>
        </div>
        {platformOrders.length > 0 ? (
          <SalesTrendChart orders={platformOrders as any} />
        ) : (
          <div className="text-center py-8 text-neutral-500 bg-neutral-100/40 rounded-lg border border-black/10">
            No orders yet.
          </div>
        )}
      </section>

      <section className="bg-white border border-black/10 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">Top Organizers by Revenue</h2>
        </div>
        {topOrganizers.length > 0 && Number(topOrganizers[0].revenue_kes) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 text-xs text-indigo-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Organizer</th>
                  <th className="py-3 px-4">Events</th>
                  <th className="py-3 px-4">Tickets Sold</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm">
                {topOrganizers.map((o: any) => (
                  <tr key={o.id} className="hover:bg-neutral-100/50 transition">
                    <td className="py-4 px-4 font-semibold text-black">
                      {o.business_name || o.full_name}
                      {o.business_name && <div className="text-xs text-neutral-500">{o.full_name}</div>}
                    </td>
                    <td className="py-4 px-4 text-neutral-700">{o.event_count}</td>
                    <td className="py-4 px-4 text-emerald-600 font-semibold">{o.tickets_sold}</td>
                    <td className="py-4 px-4 text-right text-cyan-400 font-bold">KES {Number(o.revenue_kes).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-neutral-500 bg-neutral-100/40 rounded-lg border border-black/10">
            No organizer revenue yet.
          </div>
        )}
      </section>

      <section className="bg-white border border-amber-200 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-amber-700">
            Pending Event Approvals ({pendingEvents.length})
          </h2>
        </div>

        {pendingEvents.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 bg-neutral-100/40 rounded-lg border border-black/10">
            No events waiting for review. All clear!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 text-xs text-amber-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Organizer</th>
                  <th className="py-3 px-4">Date &amp; Venue</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm">
                {pendingEvents.map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-neutral-100/50 transition">
                    <td className="py-4 px-4 font-semibold text-black">{ev.title}</td>
                    <td className="py-4 px-4 text-neutral-700">
                      {ev.organizer_name}
                      <div className="text-xs text-neutral-500">{ev.organizer_email}</div>
                    </td>
                    <td className="py-4 px-4 text-neutral-500 text-xs">
                      {ev.start_at ? new Date(ev.start_at).toLocaleDateString() : 'TBA'}
                      <div>{ev.venue_name}</div>
                    </td>
                    <td className="py-4 px-4 text-neutral-500 text-xs">{new Date(ev.updated_at).toLocaleDateString()}</td>
                    <td className="py-4 px-4 text-right">
                      <EventApprovalActions eventId={ev.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-black/10 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">
            Events & Ticket Inventory Analytics
          </h2>
          <span className="text-xs text-neutral-500">Real-time status breakdown</span>
        </div>

        {eventAnalytics.length > 0 ? (
          <div className="space-y-6">
            {eventAnalytics.map((ev) => (
              <div key={ev.id} className="bg-neutral-50 p-5 rounded-lg border border-black/10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-3 border-b border-black/10">
                  <div>
                                        <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-black">{ev.title}</h3>
                      {(() => {
                        const eventEnded =
                          ev.status !== 'cancelled' &&
                          (ev.end_at ? new Date(ev.end_at) : new Date(ev.start_at)) < new Date();
                        const isCompleted = ev.status === 'completed' || eventEnded;
                        const displayStatus = isCompleted
                          ? 'Completed'
                          : ev.status === 'pending_review'
                            ? 'Pending Review'
                            : (ev.status || 'Draft');
                        const badgeClass = isCompleted
                          ? 'bg-neutral-100 text-neutral-700 border border-black/20'
                          : ev.status === 'published'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : ev.status === 'pending_review'
                              ? 'bg-amber-50 text-amber-600 border border-amber-200'
                              : ev.status === 'cancelled'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-neutral-100 text-neutral-500 border border-black/15';
                        return (
                          <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${badgeClass}`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Created: {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-neutral-500">Revenue</p>
                      <p className="text-sm font-bold text-cyan-400">KES {ev.eventRevenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Tickets Sold</p>
                      <p className="text-sm font-bold text-emerald-600">{ev.totalSold} / {ev.totalCapacity}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 pb-3 mb-3 border-b border-black/10 text-xs">
                  {(() => {
                    const eventEnded =
                      ev.status === 'completed' ||
                      ev.status === 'cancelled' ||
                      (ev.end_at ? new Date(ev.end_at) : new Date(ev.start_at)) < new Date();
                    return (
                      <>
                        <Link
                          href={`/admin/scan/${ev.id}`}
                          className="text-neutral-700 hover:text-emerald-600 transition"
                        >
                          Scan tickets
                        </Link>
                        <span className="text-neutral-700">|</span>
                        <Link
                          href={`/organizer/events/${ev.id}/scan-overview`}
                          className="text-neutral-700 hover:text-cyan-400 transition"
                        >
                          Scan overview
                        </Link>
                        <span className="text-neutral-700">|</span>
                        <Link
                          href={`/admin/events/${ev.id}/orders`}
                          className="text-neutral-700 hover:text-indigo-400 transition"
                        >
                          Orders
                        </Link>
                        <span className="text-neutral-700">|</span>
                        <Link
                          href={`/organizer/events/${ev.id}/messages`}
                          className="text-neutral-700 hover:text-purple-600 transition"
                        >
                          Messages
                        </Link>
                        <span className="text-neutral-700">|</span>
                        <Link
                          href={`/organizer/events/${ev.id}/edit`}
                          className="text-neutral-700 hover:text-amber-600 transition"
                        >
                          Edit cover
                        </Link>
                        <span className="text-neutral-700">|</span>
                        {eventEnded ? (
                          <span className="text-neutral-600 cursor-not-allowed" title="Promo codes are disabled after the event has ended">
                            Promo codes
                          </span>
                        ) : (
                          <Link
                            href={`/organizer/events/${ev.id}/promo-codes`}
                            className="text-neutral-700 hover:text-fuchsia-600 transition"
                          >
                            Promo codes
                          </Link>
                        )}
                        <span className="text-neutral-700">|</span>
                        {eventEnded ? (
                          <span className="text-neutral-600 cursor-not-allowed" title="Flash sales are disabled after the event has ended">
                            Flash sales
                          </span>
                        ) : (
                          <Link
                            href={`/organizer/events/${ev.id}/flash-sales`}
                            className="text-neutral-700 hover:text-orange-600 transition"
                          >
                            Flash sales
                          </Link>
                        )}
                        <span className="text-neutral-700">|</span>
                        {eventEnded ? (
                          <span className="text-neutral-600 cursor-not-allowed" title="Door staff invites and scanning are disabled after the event has ended">
                            Door staff
                          </span>
                        ) : (
                          <Link
                            href={`/organizer/events/${ev.id}/staff`}
                            className="text-neutral-700 hover:text-teal-600 transition"
                          >
                            Door staff
                          </Link>
                        )}
                        <span className="text-neutral-700">|</span>
                        <AdminEventActions eventId={ev.id} status={ev.status} />
                      </>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ev.tiers.map((tier: any) => (
                    <div key={tier.id} className="bg-white p-3 rounded border border-black/10 text-xs">
                      <div className="flex justify-between font-semibold text-neutral-800">
                        <span>{tier.name}</span>
                        <span className="text-cyan-400">KES {tier.price.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-neutral-500">
                        <span>Sold: <strong className="text-emerald-600">{tier.sold}</strong></span>
                        <span>Remaining: <strong className={tier.remaining <= 0 ? 'text-red-500 font-extrabold' : 'text-amber-600'}>{tier.remaining}</strong></span>
                        <span>Total: {tier.total}</span>
                      </div>
                      {tier.remaining <= 0 && (
                        <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                          Sold Out
                        </span>
                      )}
                      <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-2">
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
          <div className="text-center py-8 text-neutral-500 bg-neutral-100/40 rounded-lg border border-black/10">
            No events found on the platform.
          </div>
        )}
      </section>

      <section className="bg-white border border-black/10 rounded-xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">
            Pending Organizer Approvals ({pendingOrganizers.length})
          </h2>
        </div>

        {pendingOrganizers.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 bg-neutral-100/40 rounded-lg border border-black/10">
            No pending organizer approvals at the moment. All clear!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 text-xs text-indigo-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Business Name</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Requested On</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm">
                {pendingOrganizers.map((o: any) => (
                  <tr key={o.id} className="hover:bg-neutral-100/50 transition">
                    <td className="py-4 px-4 font-semibold text-black">{o.business_name || 'N/A'}</td>
                    <td className="py-4 px-4 text-neutral-700">{o.full_name}</td>
                    <td className="py-4 px-4 text-neutral-500">{o.email}</td>
                    <td className="py-4 px-4 text-neutral-500">{new Date(o.created_at).toLocaleDateString()}</td>
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

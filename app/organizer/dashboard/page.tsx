import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PublishButton from '../PublishButton';
import CancelEventButton from '../CancelEventButton';
import SalesTrendChart from '@/components/SalesTrendChart';

export const dynamic = 'force-dynamic';

export default async function OrganizerDashboardPage() {
  const session = await getSession();

  if (!session) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized.</div>;
  }

  // Fetch events belonging to this organizer (or all if admin)
  const events = session.role === 'admin' 
    ? await sql`SELECT * FROM events ORDER BY created_at DESC`
    : await sql`SELECT * FROM events WHERE organizer_id = ${session.userId} ORDER BY created_at DESC`;

  // Organizers must be approved by an admin before they can create events,
  // and a suspension should immediately block creation too — checked live
  // from the DB rather than trusting the session cookie's role/state alone.
  let isVerifiedOrganizer = true;
  let isSuspended = false;
  if (session.role === 'organizer') {
    const [account] = await sql`
      SELECT u.status, COALESCE(op.is_verified, false) AS is_verified
      FROM users u
      LEFT JOIN organizer_profiles op ON op.user_id = u.id
      WHERE u.id = ${session.userId}
    `;
    isVerifiedOrganizer = account?.is_verified === true;
    isSuspended = account?.status === 'suspended';
  }

  // Cross-event overview: aggregate revenue/tickets across everything this
  // organizer owns (or, for admins, across the whole platform - matching
  // the scope of the events list above), plus a per-event leaderboard.
  const eventTotals = session.role === 'admin'
    ? await sql`
        SELECT e.id, e.title, e.slug,
               COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS revenue,
               COALESCE(SUM(o.quantity) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS tickets_sold
        FROM events e
        LEFT JOIN orders o ON o.event_id = e.id
        GROUP BY e.id
      `
    : await sql`
        SELECT e.id, e.title, e.slug,
               COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS revenue,
               COALESCE(SUM(o.quantity) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS tickets_sold
        FROM events e
        LEFT JOIN orders o ON o.event_id = e.id
        WHERE e.organizer_id = ${session.userId}
        GROUP BY e.id
      `;

  const overviewOrders = session.role === 'admin'
    ? await sql`SELECT created_at, total_amount_kes, payment_status, quantity FROM orders`
    : await sql`
        SELECT o.created_at, o.total_amount_kes, o.payment_status, o.quantity
        FROM orders o
        JOIN events e ON e.id = o.event_id
        WHERE e.organizer_id = ${session.userId}
      `;

  const totalRevenueAllEvents = eventTotals.reduce((sum: number, e: any) => sum + Number(e.revenue), 0);
  const totalTicketsAllEvents = eventTotals.reduce((sum: number, e: any) => sum + Number(e.tickets_sold), 0);
  const topEvents = [...eventTotals]
    .sort((a: any, b: any) => Number(b.revenue) - Number(a.revenue))
    .filter((e: any) => Number(e.revenue) > 0)
    .slice(0, 5);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Events & Ticket Inventory Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time status breakdown and ticket sales overview</p>
        </div>
        {isSuspended ? (
          <span
            className="bg-red-950/60 border border-red-800 text-red-300 font-medium px-4 py-2 rounded-lg text-sm"
            title="Your account has been suspended"
          >
            ⛔ Account suspended
          </span>
        ) : isVerifiedOrganizer ? (
          <Link
            href="/organizer/events/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow text-sm"
          >
            + Create Event
          </Link>
        ) : (
          <span
            className="flash-sale-badge bg-amber-950/60 border border-amber-700 text-amber-300 font-medium px-4 py-2 rounded-lg text-sm"
            title="An admin needs to approve your organizer account before you can create events"
          >
            ⏳ Pending admin approval
          </span>
        )}
      </div>

      {isSuspended && (
        <div className="mb-8 p-4 bg-red-950/40 border border-red-800 rounded-lg text-red-200 text-sm">
          Your organizer account has been suspended. You cannot create new events while suspended. Contact support if you believe this is a mistake.
        </div>
      )}

      {!isSuspended && !isVerifiedOrganizer && (
        <div className="flash-sale-badge mb-8 p-4 bg-amber-950/40 border border-amber-800 rounded-lg text-amber-200 text-sm">
          Your organizer account is awaiting approval from a TicketHub admin. Once approved, you&apos;ll be able to create and publish events. This usually doesn&apos;t take long — check back soon.
        </div>
      )}

      {events.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Overview — All Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
              <p className="text-indigo-300 font-medium text-sm">Total Revenue (all events)</p>
              <p className="text-2xl font-bold text-cyan-400 mt-2">KES {totalRevenueAllEvents.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
              <p className="text-indigo-300 font-medium text-sm">Total Tickets Sold</p>
              <p className="text-2xl font-bold text-emerald-400 mt-2">{totalTicketsAllEvents.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
              <p className="text-indigo-300 font-medium text-sm">Total Events</p>
              <p className="text-2xl font-bold text-amber-400 mt-2">{events.length}</p>
            </div>
          </div>

          <SalesTrendChart orders={overviewOrders as any} />

          {topEvents.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-indigo-300 mb-4">Top Performing Events</h3>
              <div className="space-y-2">
                {topEvents.map((e: any, i: number) => (
                  <Link
                    key={e.id}
                    href={`/organizer/events/${e.id}/analytics`}
                    className="flex items-center justify-between gap-3 bg-gray-950/60 hover:bg-gray-800/60 border border-gray-800 rounded-xl px-4 py-3 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-gray-500 font-bold text-sm w-5 shrink-0">{i + 1}</span>
                      <span className="text-white font-semibold text-sm truncate">{e.title}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-sm">
                      <span className="text-gray-400">{Number(e.tickets_sold).toLocaleString()} sold</span>
                      <span className="text-emerald-400 font-bold">KES {Number(e.revenue).toLocaleString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No events found.
        </div>
      ) : (
        <div className="space-y-6">
          {events.map(async (event: any) => {
            // Fetch ticket types and orders for revenue/tickets sold breakdown
            const ticketTypes = await sql`
              SELECT * FROM ticket_types WHERE event_id = ${event.id}
            `;
            
            const orders = await sql`
              SELECT quantity, total_amount_kes, payment_status, ticket_type_id 
              FROM orders 
              WHERE event_id = ${event.id} AND (payment_status = 'paid' OR payment_status = 'completed' OR payment_status = 'success')
            `;

            const totalRevenue = orders.reduce((acc: number, o: any) => acc + Number(o.total_amount_kes), 0);
            const totalTicketsSold = orders.reduce((acc: number, o: any) => acc + Number(o.quantity), 0);
            const totalInventory = ticketTypes.reduce((acc: number, t: any) => acc + Number(t.quantity_total), 0);

            const eventEnded = (event.end_at ? new Date(event.end_at) : new Date(event.start_at)) < new Date();


            return (
              <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{event.title}</h2>
                      {(() => {
                        const eventEnded =
                          event.status !== 'cancelled' &&
                          (event.end_at ? new Date(event.end_at) : new Date(event.start_at)) < new Date();
                        const isCompleted = event.status === 'completed' || eventEnded;
                        if (isCompleted) {
                          return (
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-gray-800 text-gray-300 border border-gray-600">
                              Completed
                            </span>
                          );
                        }
                        return (
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                            event.status === 'published' ? 'bg-green-950 text-green-400 border border-green-800'
                            : event.status === 'pending_review' ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : event.status === 'cancelled' ? 'bg-red-950 text-red-400 border border-red-800'
                            : 'bg-gray-800 text-gray-400'
                          }`}>
                            {event.status === 'pending_review' ? 'Pending Review' : event.status}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Created: {new Date(event.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <span className="text-xs text-gray-400 block">Revenue</span>
                      <span className="text-lg font-extrabold text-cyan-400">KES {totalRevenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Tickets Sold</span>
                      <span className="text-lg font-extrabold text-emerald-400">{totalTicketsSold} / {totalInventory || '∞'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-indigo-400 pt-1">
                  <Link href={`/organizer/events/${event.id}/orders`} className="hover:underline text-cyan-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Orders</Link>
                  <Link href={`/organizer/events/${event.id}/analytics`} className="hover:underline text-cyan-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Analytics</Link>
{eventEnded ? (
                    <span className="text-gray-600 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800 cursor-not-allowed" title="Flash sales are disabled after the event has ended">Flash Sales</span>
                  ) : (
                    <Link href={`/organizer/events/${event.id}/flash-sales`} className="hover:underline text-amber-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Flash Sales</Link>
                  )}
                  <Link href={`/organizer/events/${event.id}/edit`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Manage Details</Link>
                  <Link href={`/organizer/events/${event.id}/messages`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Messages</Link>
                  <Link href={`/organizer/events/${event.id}/scan-overview`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Scan Overview</Link>
                  {eventEnded ? (
                    <span className="text-gray-600 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800 cursor-not-allowed" title="Shifts closed after event ended">Shifts</span>
                  ) : (
                    <Link href={`/organizer/events/${event.id}/shifts`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Shifts</Link>
                  )}
                  <Link href={`/organizer/events/${event.id}/staff`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Door staff</Link>
                  {eventEnded ? (
                    <span className="text-gray-600 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800 cursor-not-allowed" title="Promo codes are disabled after the event has ended">Promo Codes</span>
                  ) : (
                    <Link href={`/organizer/events/${event.id}/promo-codes`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Promo Codes</Link>
                  )}
                  <Link href={`/organizer/events/new?duplicateFrom=${event.id}`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Duplicate</Link>
                  {event.status === 'draft' && (
                    <PublishButton eventId={event.id} />
                  )}
                  {event.status === 'pending_review' && (
                    <span className="flash-sale-badge bg-amber-950/50 text-amber-300 border border-amber-800/50 px-3 py-1.5 rounded-lg font-semibold">
                      Awaiting Admin Review
                    </span>
                  )}
                  {event.status !== 'cancelled' && (
                    <CancelEventButton eventId={event.id} />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {ticketTypes.map((ticket: any) => {
                    const sold = orders
                      .filter((o: any) => o.ticket_type_id === ticket.id)
                      .reduce((acc: number, o: any) => acc + Number(o.quantity), 0);
                    const remaining = ticket.quantity_total - sold;
                    const progress = Math.min(100, (sold / ticket.quantity_total) * 100);

                    return (
                      <div key={ticket.id} className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-white text-sm">{ticket.name}</h3>
                          <span className="text-indigo-300 font-bold text-sm">KES {Number(ticket.price_kes).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Sold: <strong className="text-white">{sold}</strong></span>
                          <span>Remaining: <strong className={remaining <= 0 ? 'text-red-500 font-extrabold' : 'text-white'}>{remaining}</strong></span>
                          <span>Total: <strong className="text-white">{ticket.quantity_total}</strong></span>
                        </div>
                        {remaining <= 0 && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/50 border border-red-800 rounded px-2 py-0.5">
                            Sold Out
                          </span>
                        )}
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PublishButton from '../PublishButton';
import CancelEventButton from '../CancelEventButton';

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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Events & Ticket Inventory Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time status breakdown and ticket sales overview</p>
        </div>
      </div>

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

            return (
              <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{event.title}</h2>
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                        event.status === 'published' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {event.status}
                      </span>
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
                      <span className="text-lg font-extrabold text-emerald-400">{totalTicketsSold} / {totalInventory || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-indigo-400 pt-1">
                  <Link href={`/organizer/events/${event.id}/orders`} className="hover:underline text-cyan-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Orders</Link>
                  <Link href={`/organizer/events/${event.id}/edit`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Manage Details</Link>
                  <Link href={`/organizer/events/${event.id}/messages`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Messages</Link>
                  <Link href={`/organizer/events/${event.id}/scan-overview`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Scan Overview</Link>
                  {event.status !== 'published' && event.status !== 'cancelled' && (
                    <PublishButton eventId={event.id} />
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
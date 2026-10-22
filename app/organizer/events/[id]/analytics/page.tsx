import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import SalesTrendChart from '@/components/SalesTrendChart';

export const dynamic = 'force-dynamic';

const PLATFORM_FEE_RATE = 0.1;

export default async function OrganizerEventAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-black">Please log in.</div>;
  }

  const decodedId = decodeURIComponent(id);
  const events = await sql`
    SELECT id, title, organizer_id, venue_name, start_at, status, cover_image_url
    FROM events
    WHERE id::text = ${decodedId} OR slug = ${decodedId.toLowerCase()}
  `;

  if (!events.length) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-black">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Event not found</h1>
        <Link href="/organizer/dashboard" className="text-indigo-400 hover:underline">&larr; Back to dashboard</Link>
      </main>
    );
  }

  const event = events[0];
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-black">Not authorized for this event.</div>;
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold
    FROM ticket_types WHERE event_id = ${event.id} ORDER BY price_kes ASC
  `;

  const orders = await sql`
    SELECT created_at, total_amount_kes, payment_status, quantity
    FROM orders WHERE event_id = ${event.id} ORDER BY created_at ASC
  `;

  const paidOrders = orders.filter((o: any) =>
    ['paid', 'completed', 'success'].includes(String(o.payment_status))
  );

  const checkin = await sql`
    SELECT
      COUNT(*)::int AS total_tickets,
      COUNT(*) FILTER (WHERE t.status = 'used')::int AS checked_in
    FROM tickets t
    JOIN orders o ON o.id = t.order_id
    WHERE o.event_id = ${event.id}
      AND o.payment_status IN ('paid', 'completed', 'success')
  `;
  const totalTicketsIssued = Number(checkin[0]?.total_tickets || 0);
  const checkedIn = Number(checkin[0]?.checked_in || 0);

  let totalCapacity = 0;
  let totalSold = 0;
  let grossRevenue = 0;

  const processedTiers = ticketTypes.map((t: any) => {
    const total = Number(t.quantity_total) || 0;
    const sold = Number(t.quantity_sold) || 0;
    const remaining = Math.max(0, total - sold);
    const tierPrice = Number(t.price_kes || 0);
    totalCapacity += total;
    totalSold += sold;
    grossRevenue += sold * tierPrice;
    const percentageSold = total > 0 ? Math.round((sold / total) * 100) : 0;
    return { ...t, total, sold, remaining, tierPrice, percentageSold, tierRevenue: sold * tierPrice };
  });

  const orderGross = paidOrders.reduce((s: number, o: any) => s + Number(o.total_amount_kes || 0), 0);
  const displayGross = orderGross > 0 ? orderGross : grossRevenue;
  const platformFee = Math.round(displayGross * PLATFORM_FEE_RATE);
  const netToOrganizer = displayGross - platformFee;
  const sellThrough = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;
  const checkinRate = totalTicketsIssued > 0 ? Math.round((checkedIn / totalTicketsIssued) * 100) : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-black">
      <div className="mb-6">
        <Link href="/organizer/dashboard" className="text-indigo-400 hover:underline text-sm">&larr; Back to dashboard</Link>
        <h1 className="text-3xl font-extrabold mt-2 text-black">
          Analytics: {event.title}
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          {event.venue_name}
          {event.start_at && ` · ${new Date(event.start_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-black/10">
          <p className="text-indigo-300 font-medium text-xs uppercase tracking-wider">Gross sales</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">KES {displayGross.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-black/10">
          <p className="text-indigo-300 font-medium text-xs uppercase tracking-wider">Net (after 4%)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">KES {netToOrganizer.toLocaleString()}</p>
          <p className="text-xs text-neutral-500 mt-1">Platform fee KES {platformFee.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-black/10">
          <p className="text-indigo-300 font-medium text-xs uppercase tracking-wider">Tickets sold</p>
          <p className="text-2xl font-bold text-black mt-2">
            {totalSold} <span className="text-neutral-500 text-lg">/ {totalCapacity || '∞'}</span>
          </p>
          <p className="text-xs text-amber-600 mt-1">{sellThrough}% sell-through</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-black/10">
          <p className="text-indigo-300 font-medium text-xs uppercase tracking-wider">Check-ins</p>
          <p className="text-2xl font-bold text-black mt-2">
            {checkedIn} <span className="text-neutral-500 text-lg">/ {totalTicketsIssued}</span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">{checkinRate}% of issued tickets</p>
        </div>
      </div>

      <SalesTrendChart orders={paidOrders as any} />

      <div className="bg-white p-6 rounded-xl border border-black/10 shadow-lg mt-8">
        <h2 className="text-xl font-bold mb-4 text-indigo-300">Ticket tier breakdown</h2>
        {processedTiers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 text-neutral-500 text-sm">
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Sold</th>
                  <th className="py-3 px-4">Left</th>
                  <th className="py-3 px-4">Revenue</th>
                  <th className="py-3 px-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 text-sm">
                {processedTiers.map((tier: any) => (
                  <tr key={tier.id} className="hover:bg-neutral-100/50">
                    <td className="py-3 px-4 font-semibold text-black">{tier.name}</td>
                    <td className="py-3 px-4 text-cyan-400">KES {tier.tierPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-neutral-700">{tier.total}</td>
                    <td className="py-3 px-4 text-emerald-600 font-semibold">{tier.sold}</td>
                    <td className="py-3 px-4 text-amber-600 font-semibold">{tier.remaining}</td>
                    <td className="py-3 px-4 text-black">KES {tier.tierRevenue.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-neutral-100 h-2 rounded-full overflow-hidden border border-black/15">
                          <div className="bg-indigo-500 h-full" style={{ width: `${tier.percentageSold}%` }} />
                        </div>
                        <span className="text-xs text-neutral-500">{tier.percentageSold}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500">No ticket types for this event.</p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/organizer/events/${event.id}/orders`} className="bg-neutral-100 hover:bg-neutral-200 text-black text-sm font-semibold px-4 py-2 rounded-lg border border-black/15">Orders</Link>
        <Link href={`/organizer/events/${event.id}/scan-overview`} className="bg-neutral-100 hover:bg-neutral-200 text-black text-sm font-semibold px-4 py-2 rounded-lg border border-black/15">Live check-in</Link>
        <Link href="/organizer/analytics" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">All events analytics</Link>
      </div>
    </main>
  );
}

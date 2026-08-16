import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import SalesTrendChart from '@/components/SalesTrendChart';

export const dynamic = 'force-dynamic';

export default async function OrganizerEventAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized.</div>;
  }

  const decodedId = decodeURIComponent(id);
  const events = await sql`
    SELECT id, title, organizer_id FROM events
    WHERE id::text = ${decodedId} OR slug = ${decodedId.toLowerCase()} OR title ILIKE ${decodedId}
  `;

  if (events.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-white">
        <h1 className="text-2xl font-bold text-red-400 mb-2">Event Not Found</h1>
        <p className="text-gray-400">Could not find an event matching: <code className="bg-gray-800 px-2 py-1 rounded text-cyan-300">{decodedId}</code></p>
        <div className="mt-6">
          <Link href="/organizer/dashboard" className="text-indigo-400 hover:underline">&larr; Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const event = events[0];

  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Not authorized for this event.</div>;
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold
    FROM ticket_types
    WHERE event_id = ${event.id}
  `;

  const orders = await sql`
    SELECT created_at, total_amount_kes, payment_status, quantity
    FROM orders
    WHERE event_id = ${event.id}
  `;

  let totalCapacity = 0;
  let totalSold = 0;
  let totalRevenue = 0;

  const processedTiers = ticketTypes.map((t: any) => {
    const total = Number(t.quantity_total) || 0;
    const sold = Number(t.quantity_sold) || 0;
    const remaining = Math.max(0, total - sold);
    const tierPrice = Number(t.price_kes || 0);

    totalCapacity += total;
    totalSold += sold;
    totalRevenue += sold * tierPrice;

    const percentageSold = total > 0 ? Math.round((sold / total) * 100) : 0;

    return {
      ...t,
      total,
      sold,
      remaining,
      tierPrice,
      percentageSold,
    };
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-white">
      <div className="mb-6">
        <Link href="/organizer/dashboard" className="text-indigo-400 hover:underline">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          Analytics: {event.title}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Real-time inventory and revenue tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Total Revenue Generated</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">KES {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Tickets Sold / Capacity</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{totalSold} <span className="text-gray-500 text-lg">/ {totalCapacity}</span></p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Overall Sell-Through</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">
            {totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0}%
          </p>
        </div>
      </div>

      <SalesTrendChart orders={orders as any} />

      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg mt-8">
        <h2 className="text-xl font-bold mb-4 text-indigo-300">Ticket Tier Breakdown</h2>
        {processedTiers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-sm">
                  <th className="py-3 px-4">Tier Name</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Total Capacity</th>
                  <th className="py-3 px-4">Sold</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {processedTiers.map((tier: any) => (
                  <tr key={tier.id} className="hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-semibold text-white">{tier.name}</td>
                    <td className="py-3 px-4 text-cyan-400">KES {tier.tierPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-300">{tier.total}</td>
                    <td className="py-3 px-4 text-emerald-400 font-semibold">{tier.sold}</td>
                    <td className="py-3 px-4 text-amber-400 font-semibold">{tier.remaining}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
                          <div
                            className="bg-indigo-500 h-full"
                            style={{ width: `${tier.percentageSold}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{tier.percentageSold}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400">No ticket types found for this event.</p>
        )}
      </div>
    </main>
  );
}

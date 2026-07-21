import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import RefundButton from './RefundButton';

export const dynamic = 'force-dynamic';

export default async function EventOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized.</div>;
  }

  const decodedId = decodeURIComponent(id);

  // Fetch event by UUID or fallback to slug/title match
  const events = await sql`
    SELECT id, title FROM events 
    WHERE id::text = ${decodedId} OR slug = ${decodedId.toLowerCase()} OR title ILIKE ${decodedId}
  `;

  if (events.length === 0) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-white">
        <h1 className="text-2xl font-bold text-red-400 mb-2">Event Not Found</h1>
        <p className="text-gray-400">Could not find an event matching: <code className="bg-gray-800 px-2 py-1 rounded text-cyan-300">{decodedId}</code></p>
        <div className="mt-6">
          <Link href="/admin/events" className="text-indigo-400 hover:underline">&larr; Back to Events Dashboard</Link>
        </div>
      </main>
    );
  }

  const event = events[0];

  // Fetch orders using the correct event UUID
  const orders = await sql`
    SELECT o.id, o.quantity, o.total_amount_kes, o.payment_status, o.created_at, o.buyer_name, o.buyer_email, t.name as ticket_name
    FROM orders o
    LEFT JOIN ticket_types t ON t.id = o.ticket_type_id
    WHERE o.event_id = ${event.id}
    ORDER BY o.created_at DESC
  `;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Orders for {event.title}</h1>
          <p className="text-gray-400 text-sm mt-1">Review ticket purchases, customer details, and process refunds</p>
        </div>
        <Link
          href="/admin/events"
          className="bg-gray-800 hover:bg-gray-700 text-indigo-300 font-semibold px-4 py-2 rounded-lg border border-gray-700 transition shadow"
        >
          &larr; Back
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No orders found for this event yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div
              key={order.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition hover:border-gray-700"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white">{order.buyer_name || order.buyer_email || 'Customer'}</h2>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                    order.payment_status === 'completed' || order.payment_status === 'paid' || order.payment_status === 'success' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {order.payment_status || 'pending'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Email: <span className="text-indigo-300 font-semibold">{order.buyer_email}</span> | Ticket: <span className="text-cyan-300 font-semibold">{order.ticket_name || 'Standard Ticket'}</span> (Qty: {order.quantity})
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ordered on: {new Date(order.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end pt-4 md:pt-0 border-t md:border-t-0 border-gray-800">
                <div className="text-right">
                  <span className="text-xs text-gray-400 block">Total Amount</span>
                  <span className="text-lg font-bold text-indigo-300">KES {Number(order.total_amount_kes).toLocaleString()}</span>
                </div>

                {order.payment_status !== 'refunded' && (
                  <RefundButton orderId={order.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
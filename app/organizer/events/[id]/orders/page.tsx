import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import RefundButton from './RefundButton';

export const dynamic = 'force-dynamic';

export default async function EventOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const events = await sql`
    SELECT title FROM events WHERE id = ${id} AND organizer_id = ${session!.userId}
  `;

  if (events.length === 0) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Event not found or unauthorized.</div>;
  }

  const event = events[0];

  const orders = await sql`
    SELECT o.id, o.quantity, o.total_amount, o.status, o.created_at, u.full_name, u.email, t.name as ticket_name
    FROM orders o
    JOIN users u ON u.id = o.user_id
    JOIN ticket_types t ON t.id = o.ticket_type_id
    WHERE o.event_id = ${id}
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
          href="/organizer/dashboard"
          className="bg-gray-800 hover:bg-gray-700 text-indigo-300 font-semibold px-4 py-2 rounded-lg border border-gray-700 transition shadow"
        >
          &larr; Back to Dashboard
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
                  <h2 className="text-lg font-bold text-white">{order.full_name}</h2>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                    order.status === 'completed' || order.status === 'paid' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Email: <span className="text-indigo-300 font-semibold">{order.email}</span> | Ticket: <span className="text-cyan-300 font-semibold">{order.ticket_name}</span> (Qty: {order.quantity})
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ordered on: {new Date(order.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end pt-4 md:pt-0 border-t md:border-t-0 border-gray-800">
                <div className="text-right">
                  <span className="text-xs text-gray-400 block">Total Amount</span>
                  <span className="text-lg font-bold text-indigo-300">${Number(order.total_amount).toFixed(2)}</span>
                </div>

                {order.status !== 'refunded' && (
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
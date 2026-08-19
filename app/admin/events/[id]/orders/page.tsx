import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import RefundButton from './RefundButton';
import { canRefundOrder, isEventEnded } from '@/lib/eventStatus';

export const dynamic = 'force-dynamic';

export default async function EventOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized.</div>;
  }

  const decodedId = decodeURIComponent(id);

  const events = await sql`
    SELECT id, title, start_at, end_at, status FROM events
    WHERE id::text = ${decodedId} OR slug = ${decodedId.toLowerCase()} OR title ILIKE ${decodedId}
  `;

  if (events.length === 0) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-white">
        <h1 className="text-2xl font-bold text-red-400 mb-2">Event Not Found</h1>
        <p className="text-gray-400">
          Could not find an event matching:{' '}
          <code className="bg-gray-800 px-2 py-1 rounded text-cyan-300">{decodedId}</code>
        </p>
        <div className="mt-6">
          <Link href="/admin/events" className="text-indigo-400 hover:underline">
            &larr; Back to Events Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const event = events[0];
  const eventEnded = isEventEnded({
    status: event.status,
    start_at: event.start_at,
    end_at: event.end_at,
  });

  const orders = await sql`
    SELECT o.id, o.quantity, o.total_amount_kes, o.payment_status, o.created_at,
           o.buyer_name, o.buyer_email, t.name as ticket_name
    FROM orders o
    LEFT JOIN ticket_types t ON t.id = o.ticket_type_id
    WHERE o.event_id = ${event.id}
    ORDER BY o.created_at DESC
  `;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Orders for {event.title}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Review ticket purchases, customer details, and process refunds
            {eventEnded && (
              <span className="text-amber-400"> · Event ended — refunds disabled</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/events/${event.id}/orders/export`}
            className="bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/60 font-semibold px-4 py-2 rounded-lg text-sm transition"
          >
            Export CSV
          </a>
          <Link href="/admin/events" className="text-sm text-indigo-400 hover:underline self-center">
            &larr; Events
          </Link>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No orders found for this event yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => {
            const showRefund = canRefundOrder(order, event);
            const isPaid = String(order.payment_status || '').toLowerCase() === 'paid';
            return (
              <div
                key={order.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition hover:border-gray-700"
              >
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-bold text-white">
                      {order.buyer_name || order.buyer_email || 'Customer'}
                    </h2>
                    <span
                      className={
                        'px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ' +
                        (isPaid
                          ? 'bg-green-950 text-green-400 border border-green-800'
                          : order.payment_status === 'refunded'
                            ? 'bg-gray-800 text-gray-400 border border-gray-700'
                            : 'bg-amber-950 text-amber-400 border border-amber-800')
                      }
                    >
                      {order.payment_status || 'pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Email: <span className="text-indigo-300 font-semibold">{order.buyer_email}</span> | Ticket:{' '}
                    <span className="text-cyan-300 font-semibold">
                      {order.ticket_name || 'Standard Ticket'}
                    </span>{' '}
                    (Qty: {order.quantity})
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ordered on: {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end pt-4 md:pt-0 border-t md:border-t-0 border-gray-800">
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Total Amount</span>
                    <span className="text-lg font-bold text-indigo-300">
                      KES {Number(order.total_amount_kes).toLocaleString()}
                    </span>
                  </div>

                  {showRefund && <RefundButton orderId={order.id} />}
                  {isPaid && eventEnded && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">Refund closed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

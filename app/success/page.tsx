import Link from "next/link";
import TicketList from "@/components/TicketList";
import { sql } from "@/lib/db";

export const dynamic = 'force-dynamic';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const reference = resolvedSearchParams.reference;

  let order = null;
  let realTickets: any[] = [];

  if (reference) {
    try {
      const orders = await sql`
        SELECT o.*, e.title as event_title, e.venue_name, e.start_at
        FROM orders o
        LEFT JOIN events e ON o.event_id = e.id
        WHERE o.paystack_reference = ${reference}
        LIMIT 1
      `;
      order = orders[0] || null;

      if (order) {
        realTickets = await sql`
          SELECT ticket_code FROM tickets WHERE order_id = ${order.id}
        `;
      }
    } catch (err) {
      console.error("Database query failed:", err);
    }
  }

  const quantity = order ? Number(order.quantity || 1) : 1;
  const displayReference = order?.paystack_reference || reference || "TICKET-REF";
  const eventTitle = order?.event_title || "TicketHub Event";
  const buyerName = order?.buyer_name || "Valued Guest";

  // Webhooks fire asynchronously and can lag a few seconds behind the redirect,
  // so real ticket rows may not exist yet even though payment succeeded.
  const ticketsPending = !!order && order.payment_status === 'paid' && realTickets.length === 0;

  const tickets = realTickets.map((t: any, index: number) => {
    const ticketCode = t.ticket_code;
    const qrData = JSON.stringify({
      ticketNumber: index + 1,
      totalTickets: quantity,
      orderId: order?.id,
      event: eventTitle,
      buyer: buyerName,
      ticketCode,
      reference: displayReference
    });
    return { ticketCode, qrData };
  });

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-white">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl space-y-6 shadow-2xl text-center">
        <div className="w-16 h-16 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ✓
        </div>
        <h1 className="text-3xl font-extrabold">Payment Successful!</h1>
        <p className="text-gray-300">
          Your order has been confirmed. You purchased {quantity} ticket{quantity > 1 ? "s" : ""}.
        </p>

        <div className="bg-gray-950 p-6 rounded-xl border border-gray-800 space-y-6 text-left">
          <div className="flex justify-between text-sm border-b border-gray-800 pb-3">
            <span className="text-gray-400">Event:</span>
            <span className="font-bold text-white">{eventTitle}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-gray-800 pb-3">
            <span className="text-gray-400">Ticket Holder:</span>
            <span className="font-bold text-white">{buyerName}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-gray-800 pb-3">
            <span className="text-gray-400">Reference:</span>
            <span className="font-mono text-cyan-400 text-xs">{displayReference}</span>
          </div>

          {ticketsPending ? (
            <div className="text-center py-6">
              <p className="text-amber-400 font-semibold mb-2">Your tickets are being generated…</p>
              <p className="text-xs text-gray-400 mb-4">This usually takes a few seconds. Refresh this page shortly, or check your email — we've sent your tickets there too.</p>
              
                href={`/success?reference=${displayReference}`}
                className="inline-block px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Refresh
              </a>
            </div>
          ) : tickets.length > 0 ? (
            <TicketList tickets={tickets} eventTitle={eventTitle} quantity={quantity} />
          ) : (
            <p className="text-gray-400 text-sm">
              We couldn't find your tickets yet. Check your email for your confirmation, or contact support with reference <span className="font-mono text-cyan-400">{displayReference}</span>.
            </p>
          )}
        </div>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
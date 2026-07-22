import { sql } from '@/lib/db';
import Link from 'next/link';
import TicketList from '@/components/TicketList';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string; reference_code?: string }>
}) {
  const resolvedParams = await searchParams;
  const reference = resolvedParams.reference || resolvedParams.trxref || resolvedParams.reference_code;

  if (!reference) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center text-white">
        <h1 className="text-3xl font-bold mb-4">No Reference Provided</h1>
        <p className="text-gray-400 mb-8">We could not find a payment reference in your request.</p>
        <Link href="/" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition">
          Return Home
        </Link>
      </div>
    );
  }

  let tickets: any = [];
  let eventTitle = "Your Event";
  let quantity = 1;
  let displayReference = reference;

  try {
    const result = await sql`
      SELECT * FROM tickets WHERE reference = ${reference} OR payment_reference = ${reference}
    `;
    tickets = Array.isArray(result) ? result : (result?.rows || []);

    if (tickets.length > 0) {
      quantity = tickets.length;
      eventTitle = tickets[0].event_title || tickets[0].eventTitle || "Event Ticket";
    }
  } catch (err) {
    console.error("Database query error:", err);
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-white">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-xl">
        <h1 className="text-3xl font-extrabold mb-2 text-center text-green-400">Payment Successful!</h1>
        <p className="text-gray-400 text-center mb-8">Your order has been verified and confirmed.</p>

        {tickets.length === 0 ? (
          <div className="bg-yellow-950/40 border border-yellow-800/60 p-6 rounded-2xl text-center space-y-4">
            <p className="text-yellow-200">We are currently processing your ticket generation or recording your payment. If your tickets don't appear immediately, please refresh.</p>
            <p className="text-xs text-gray-400 font-mono">Ref: {displayReference}</p>
            <Link
              href={`/success?reference=${displayReference}`}
              className="inline-block px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Refresh
            </Link>
          </div>
        ) : (
          <TicketList tickets={tickets} eventTitle={eventTitle} quantity={quantity} />
        )}
      </div>
    </div>
  );
}
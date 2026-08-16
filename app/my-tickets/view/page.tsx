ï»¿import { sql } from '@/lib/db';
import { verifyTicketsMagicLink } from '@/lib/auth';
import { getTicketDisplayStatus } from '@/lib/tickets';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MyTicketsViewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect('/my-tickets');

  const verified = await verifyTicketsMagicLink(token);
  if (!verified) {
    return (
      <main className="max-w-md mx-auto py-16 px-4 text-white text-center">
        <h1 className="text-xl font-bold text-red-400 mb-2">Link expired or invalid</h1>
        <p className="text-gray-400 text-sm mb-6">
          Magic links work for one hour. Request a new one with the same email.
        </p>
        <Link
          href="/my-tickets"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
        >
          Request new link
        </Link>
      </main>
    );
  }

  const email = verified.email;

  const orders = await sql`
    SELECT
      o.id,
      o.quantity,
      o.total_amount_kes,
      o.created_at,
      o.payment_status,
      e.title AS event_title,
      e.venue_name,
      e.start_at,
      e.end_at,
      e.status AS event_status,
      e.slug
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE LOWER(o.buyer_email) = ${email}
      AND o.payment_status = 'paid'
    ORDER BY o.created_at DESC
  `;

  const orderIds = orders.map((o) => o.id as string);
  let tickets: Record<string, unknown>[] = [];
  if (orderIds.length > 0) {
    tickets = await sql`
      SELECT t.ticket_code, t.status, t.holder_name, t.order_id, tt.name AS ticket_type
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.order_id = ANY(${orderIds})
      ORDER BY t.ticket_code ASC
    `;
  }

  const ticketsByOrder = new Map<string, typeof tickets>();
  for (const t of tickets) {
    const oid = t.order_id as string;
    if (!ticketsByOrder.has(oid)) ticketsByOrder.set(oid, []);
    ticketsByOrder.get(oid)!.push(t);
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-white">
      <h1 className="text-2xl font-extrabold mb-1">Your tickets</h1>
      <p className="text-gray-400 text-sm mb-6">
        Showing paid orders for <span className="text-indigo-300">{email}</span>
      </p>

      {orders.length === 0 ? (
        <p className="text-gray-500">No paid tickets found for this email.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const list = ticketsByOrder.get(o.id as string) || [];
            return (
              <li key={o.id as string} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <h2 className="font-bold text-lg">{o.event_title as string}</h2>
                    <p className="text-xs text-gray-500">
                      {o.venue_name ? `${o.venue_name} Â· ` : ''}
                      {o.start_at ? new Date(o.start_at as string).toLocaleString('en-KE') : ''}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-emerald-400 font-semibold">
                      KES {Number(o.total_amount_kes).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {Number(o.quantity)} ticket{Number(o.quantity) === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                {list.length === 0 ? (
                  <p className="text-amber-400/90 text-sm">Tickets are still being issuedâ€¦</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((t) => {
                      const displayStatus = getTicketDisplayStatus(t.status as string, {
                        status: o.event_status as string,
                        start_at: o.start_at as string,
                        end_at: o.end_at as string,
                      });
                      return (
                      <li
                        key={t.ticket_code as string}
                        className="flex justify-between items-center bg-gray-950/80 border border-gray-800 rounded-xl px-3 py-2.5"
                      >
                        <div>
                          <span className="font-mono text-sm text-indigo-300">
                            {t.ticket_code as string}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {(t.ticket_type as string) || 'Ticket'}
                            {t.holder_name ? ` Â· ${t.holder_name}` : ''}
                          </span>
                          {displayStatus === 'used' && (
                            <span className="ml-2 text-xs text-red-400">Used</span>
                          )}
                          {displayStatus === 'expired' && (
                            <span className="ml-2 text-xs text-gray-500">Expired</span>
                          )}
                        </div>
                        <Link
                          href={`/tickets/${t.ticket_code}`}
                          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg"
                        >
                          Open QR
                        </Link>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-gray-600 mt-8 text-center">
        This page was opened with a private link. Do not share it. Request a new link anytime at{' '}
        <Link href="/my-tickets" className="text-indigo-400">
          /my-tickets
        </Link>
        .
      </p>
    </main>
  );
}
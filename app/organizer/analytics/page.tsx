import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import SalesTrendChart from '@/components/SalesTrendChart';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PLATFORM_FEE_RATE = 0.1;

export default async function OrganizerAnalyticsOverviewPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return <div className="max-w-5xl mx-auto px-4 py-8 text-white">Organizer access only.</div>;
  }

  const isAdmin = session.role === 'admin';

  const eventRows = isAdmin
    ? await sql`
        SELECT e.id, e.title, e.status, e.start_at, e.slug,
               COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS revenue,
               COALESCE(SUM(o.quantity) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS tickets_sold
        FROM events e
        LEFT JOIN orders o ON o.event_id = e.id
        GROUP BY e.id
        ORDER BY revenue DESC
      `
    : await sql`
        SELECT e.id, e.title, e.status, e.start_at, e.slug,
               COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS revenue,
               COALESCE(SUM(o.quantity) FILTER (WHERE o.payment_status IN ('paid','completed','success')), 0) AS tickets_sold
        FROM events e
        LEFT JOIN orders o ON o.event_id = e.id
        WHERE e.organizer_id = ${session.userId}
        GROUP BY e.id
        ORDER BY revenue DESC
      `;

  const overviewOrders = isAdmin
    ? await sql`
        SELECT created_at, total_amount_kes, payment_status, quantity
        FROM orders WHERE payment_status IN ('paid','completed','success') ORDER BY created_at ASC
      `
    : await sql`
        SELECT o.created_at, o.total_amount_kes, o.payment_status, o.quantity
        FROM orders o
        JOIN events e ON e.id = o.event_id
        WHERE e.organizer_id = ${session.userId}
          AND o.payment_status IN ('paid','completed','success')
        ORDER BY o.created_at ASC
      `;

  const totalRevenue = eventRows.reduce((s: number, e: any) => s + Number(e.revenue), 0);
  const totalTickets = eventRows.reduce((s: number, e: any) => s + Number(e.tickets_sold), 0);
  const platformFee = Math.round(totalRevenue * PLATFORM_FEE_RATE);
  const net = totalRevenue - platformFee;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-white">
      <div className="mb-8">
        <Link href="/organizer/dashboard" className="text-indigo-400 hover:underline text-sm">&larr; Dashboard</Link>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mt-2">Sales analytics</h1>
        <p className="text-gray-400 text-sm mt-1">All your events · paid orders only</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 p-5 rounded-xl border border-gray-800">
          <p className="text-xs uppercase tracking-wider text-indigo-300 font-medium">Gross sales</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">KES {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl border border-gray-800">
          <p className="text-xs uppercase tracking-wider text-indigo-300 font-medium">Net after 10%</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">KES {net.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Fees KES {platformFee.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl border border-gray-800">
          <p className="text-xs uppercase tracking-wider text-indigo-300 font-medium">Tickets sold</p>
          <p className="text-2xl font-bold text-white mt-2">{totalTickets.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">{eventRows.length} event(s)</p>
        </div>
      </div>

      <SalesTrendChart orders={overviewOrders as any} />

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
        <h2 className="text-lg font-bold text-indigo-300 mb-4">By event</h2>
        {eventRows.length === 0 ? (
          <p className="text-gray-500 text-sm">No events yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {eventRows.map((e: any) => (
              <li key={e.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{e.title}</p>
                  <p className="text-xs text-gray-500">
                    {e.status}
                    {e.start_at && ` · ${new Date(e.start_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-cyan-400 font-bold">KES {Number(e.revenue).toLocaleString()}</span>
                  <span className="text-gray-400">{Number(e.tickets_sold)} tix</span>
                  <Link href={`/organizer/events/${e.id}/analytics`} className="text-indigo-400 hover:text-cyan-400 font-semibold">Details →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

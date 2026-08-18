import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');

  const { q: qRaw } = await searchParams;
  const q = (qRaw || '').trim();

  let orders: any[] = [];
  if (q.length >= 2) {
    const like = `%${q.toLowerCase()}%`;
    orders = (await sql`
      SELECT o.id, o.buyer_name, o.buyer_email, o.buyer_phone, o.payment_status,
             o.total_amount_kes, o.quantity, o.paystack_reference, o.created_at,
             e.id AS event_id, e.title AS event_title, e.slug,
             u.full_name AS organizer_name
      FROM orders o
      JOIN events e ON e.id = o.event_id
      JOIN users u ON u.id = e.organizer_id
      WHERE
        LOWER(o.buyer_email) LIKE ${like}
        OR LOWER(COALESCE(o.buyer_name, '')) LIKE ${like}
        OR LOWER(COALESCE(o.buyer_phone, '')) LIKE ${like}
        OR LOWER(COALESCE(o.paystack_reference, '')) LIKE ${like}
        OR o.id::text = ${q}
      ORDER BY o.created_at DESC
      LIMIT 50
    `) as any[];
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 text-white">
      <Link href="/admin/dashboard" className="text-sm text-indigo-400 hover:underline">&larr; Admin</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-2">Order search</h1>
      <p className="text-gray-400 text-sm mb-6">Search by email, name, phone, Paystack reference, or order UUID.</p>
      <form className="flex gap-2 mb-8">
        <input name="q" defaultValue={q} placeholder="email, phone, reference…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-semibold">Search</button>
      </form>
      {q && orders.length === 0 && <p className="text-gray-500 text-sm">No orders matched &ldquo;{q}&rdquo;.</p>}
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-bold text-white">{o.buyer_name}</p>
                <p className="text-gray-400">{o.buyer_email} · {o.buyer_phone || '—'}</p>
                <p className="text-gray-500 text-xs mt-1">Ref: {o.paystack_reference || '—'} · {o.id}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-cyan-400">KES {Number(o.total_amount_kes).toLocaleString()}</p>
                <p className="text-xs uppercase text-gray-400">{o.payment_status}</p>
              </div>
            </div>
            <p className="mt-2 text-gray-300">
              <Link href={`/events/${o.slug || o.event_id}`} className="text-indigo-400 hover:underline">{o.event_title}</Link>
              <span className="text-gray-500"> · {o.organizer_name}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link href={`/admin/events/${o.event_id}/orders`} className="text-indigo-400 hover:underline">Event orders</Link>
              <Link href={`/organizer/events/${o.event_id}/scan-overview`} className="text-indigo-400 hover:underline">Scan overview</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

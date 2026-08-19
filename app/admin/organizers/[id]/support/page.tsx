import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizerSupportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');
  const { id } = await params;

  const [org] = await sql`
    SELECT u.id, u.full_name, u.email, u.status, u.role,
           op.business_name, op.is_verified
    FROM users u
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    WHERE u.id = ${id}
  `;
  if (!org) notFound();

  const events = await sql`
    SELECT e.id, e.title, e.status, e.start_at, e.end_at, e.slug,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'paid')::int AS paid_orders,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE e.organizer_id = ${id}
    GROUP BY e.id
    ORDER BY e.start_at DESC
  `;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 text-white">
      <Link href="/admin/organizers" className="text-sm text-indigo-400 hover:underline">&larr; Organizers</Link>
      <div className="mt-2 mb-1 inline-block text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-black px-2 py-0.5 rounded">
        Support view · read-only
      </div>
      <h1 className="text-2xl font-extrabold">{org.business_name || org.full_name}</h1>
      <p className="text-gray-400 text-sm mb-6">
        {org.email} · {org.is_verified ? 'Verified' : 'Unverified'} · {org.status}
      </p>
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Events</h2>
      <ul className="space-y-3">
        {(events as any[]).map((e) => (
          <li key={e.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="font-bold">{e.title}</p>
            <p className="text-xs text-gray-400">
              {e.status} · {e.start_at ? new Date(e.start_at).toLocaleString() : '—'} · {e.paid_orders} paid · KES {Number(e.gross).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <Link className="px-2 py-1 rounded bg-gray-800 border border-gray-700" href={`/admin/events/${e.id}/orders`}>Orders</Link>
              <Link className="px-2 py-1 rounded bg-gray-800 border border-gray-700" href={`/admin/events/${e.id}/analytics`}>Analytics</Link>
              <Link className="px-2 py-1 rounded bg-gray-800 border border-gray-700" href={`/organizer/events/${e.id}/scan-overview`}>Scan</Link>
              <Link className="px-2 py-1 rounded bg-gray-800 border border-gray-700" href={`/organizer/events/${e.id}/staff`}>Staff</Link>
              <Link className="px-2 py-1 rounded bg-gray-800 border border-gray-700" href={`/organizer/events/${e.id}/shifts`}>Shifts</Link>
              <Link className="px-2 py-1 rounded bg-gray-800 border border-gray-700" href={`/events/${e.slug || e.id}`}>Public</Link>
            </div>
          </li>
        ))}
      </ul>
      {(events as any[]).length === 0 && <p className="text-gray-500 text-sm">No events.</p>}
    </div>
  );
}

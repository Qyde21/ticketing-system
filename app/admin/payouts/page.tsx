import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { computeNet, PLATFORM_FEE_RATE } from '@/lib/payouts';
import AdminProcessPayoutButton from '@/components/AdminProcessPayoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');

  const organizers = await sql`
    SELECT u.id, u.full_name, u.email,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded
    FROM users u
    JOIN events e ON e.organizer_id = u.id
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE u.role = 'organizer'
    GROUP BY u.id
    ORDER BY gross DESC
  `;

  const pendingPayouts = await sql`
    SELECT p.id, p.net_kes, p.status, p.failure_reason, p.requested_at,
           e.title AS event_title, u.full_name, u.email
    FROM organizer_payouts p
    JOIN events e ON e.id = p.event_id
    JOIN users u ON u.id = p.organizer_id
    WHERE p.status IN ('pending', 'processing', 'failed')
    ORDER BY p.requested_at ASC
    LIMIT 50
  `;

  let totalGross = 0;
  let totalRefunded = 0;
  for (const o of organizers) {
    totalGross += Number(o.gross);
    totalRefunded += Number(o.refunded);
  }
  const totalFees = Math.round((totalGross - totalRefunded) * PLATFORM_FEE_RATE * 100) / 100;
  const totalNet = Math.round((totalGross - totalRefunded - totalFees) * 100) / 100;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 text-white">
      <Link href="/admin/dashboard" className="text-sm text-indigo-400 hover:underline">&larr; Admin</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-6">Platform payouts</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        <a
          href="https://dashboard.paystack.com/#/transfers"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
        >
          Paystack dashboard → Transfers
        </a>
        <a
          href="https://dashboard.paystack.com/#/transfers/recipients"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition"
        >
          Recipients
        </a>
      </div>
      <div className="flex gap-3 flex-wrap mb-8">
        {[
          { label: 'Gross paid', value: totalGross, color: 'text-indigo-400' },
          { label: 'Platform fees (10%)', value: totalFees, color: 'text-amber-400' },
          { label: 'Organizer net', value: totalNet, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 min-w-[140px]">
            <div className={`text-xl font-bold ${s.color}`}>
              KES {s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-bold mb-3">Queue (pending / failed)</h2>
      {pendingPayouts.length === 0 ? (
        <p className="text-gray-500 text-sm mb-8">No payouts waiting.</p>
      ) : (
        <ul className="space-y-2 mb-8">
          {pendingPayouts.map((p) => (
            <li key={p.id as string} className="flex justify-between items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold text-sm">{p.event_title as string}</div>
                <div className="text-xs text-gray-500">
                  {p.full_name as string} · {p.email as string} · {p.status as string}
                  {p.failure_reason ? ` · ${p.failure_reason}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold text-sm">KES {Number(p.net_kes).toLocaleString()}</span>
                <AdminProcessPayoutButton payoutId={p.id as string} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-lg font-bold mb-3">Organizers</h2>
      <ul className="space-y-2">
        {organizers.map((o) => {
          const c = computeNet(Number(o.gross), Number(o.refunded));
          return (
            <li key={o.id as string} className="flex justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold text-sm">{(o.full_name as string) || 'Organizer'}</div>
                <div className="text-xs text-gray-500">{o.email as string}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-emerald-400 font-bold">KES {c.net.toLocaleString(undefined, { maximumFractionDigits: 0 })} net</div>
                <div className="text-xs text-amber-400">KES {c.fee.toLocaleString(undefined, { maximumFractionDigits: 0 })} fees</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

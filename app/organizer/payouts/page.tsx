import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import PayoutAccountForm from '@/components/PayoutAccountForm';
import RequestPayoutButton from '@/components/RequestPayoutButton';
import { computeNet, PLATFORM_FEE_RATE } from '@/lib/payouts';

export const dynamic = 'force-dynamic';

export default async function PayoutsPage() {
  const session = await getSession();
  if (!session?.userId) redirect('/login?next=/organizer/payouts');
  if (session.role !== 'organizer' && session.role !== 'admin') redirect('/');

  const events = await sql`
    SELECT
      e.id, e.title, e.status, e.start_at, e.end_at,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'paid') AS paid_orders,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'refunded') AS refunded_orders,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross_revenue,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded_amount
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE e.organizer_id = ${session.userId}
    GROUP BY e.id
    ORDER BY e.start_at DESC
  `;

  const payouts = await sql`
    SELECT event_id, status, net_kes, paid_at, failure_reason
    FROM organizer_payouts WHERE organizer_id = ${session.userId}
  `;
  const payoutByEvent = new Map(payouts.map((p) => [p.event_id as string, p]));

  let totalGross = 0;
  let totalRefunded = 0;
  let totalNet = 0;
  for (const e of events) {
    const c = computeNet(Number(e.gross_revenue), Number(e.refunded_amount));
    totalGross += c.gross;
    totalRefunded += c.refunded;
    totalNet += c.net;
  }
  const totalFees = Math.round((totalGross - totalRefunded) * PLATFORM_FEE_RATE * 100) / 100;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-6">Payouts</h1>
      <PayoutAccountForm />
      <div className="flex gap-3 flex-wrap mb-6">
        {[
          { label: 'Gross (paid)', value: totalGross, color: 'text-indigo-400' },
          { label: 'Fee (10%)', value: totalFees, color: 'text-amber-400' },
          { label: 'Refunded', value: totalRefunded, color: 'text-red-400' },
          { label: 'Net earnings', value: totalNet, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="flex-1 min-w-[120px] bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <div className={`text-xl font-bold ${s.color}`}>
              KES {s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-bold mb-3">Per event</h2>
      <ul className="space-y-2">
        {events.map((e) => {
          const c = computeNet(Number(e.gross_revenue), Number(e.refunded_amount));
          const existing = payoutByEvent.get(e.id as string);
          const ended = new Date(String(e.end_at || e.start_at)).getTime() < Date.now();
          let disabledReason: string | null = null;
          if (existing?.status === 'paid') disabledReason = 'Already paid';
          else if (existing?.status === 'processing') disabledReason = 'Processing…';
          else if (!ended) disabledReason = 'Available after event ends';
          else if (c.net < 50) disabledReason = 'Below minimum';
          return (
            <li key={e.id as string} className="flex justify-between gap-3 items-center bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold text-sm">{e.title as string}</div>
                <div className="text-xs text-gray-500">
                  {new Date(String(e.start_at)).toLocaleDateString()} · {e.status as string} · {Number(e.paid_orders)} paid
                  {existing && <span className="ml-2 text-indigo-300">· payout {existing.status as string}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-bold text-emerald-400 text-sm">
                    KES {c.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    fee {c.fee.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <RequestPayoutButton eventId={e.id as string} netKes={c.net} disabledReason={disabledReason} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-500 mt-6">
        Net = (paid − refunded) − 10% platform fee. Automatic payouts run ~48 hours after the event ends if your account is saved.
      </p>
    </div>
  );
}

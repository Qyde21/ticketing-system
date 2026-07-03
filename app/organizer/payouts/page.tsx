import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PayoutsPage() {
  const session = await getSession();

  const events = await sql`
    SELECT
      e.id,
      e.title,
      e.status,
      e.start_at,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'paid') AS paid_orders,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'refunded') AS refunded_orders,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross_revenue,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded_amount
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE e.organizer_id = ${session!.userId}
    GROUP BY e.id
    ORDER BY e.start_at DESC
  `;

  const totalGross = events.reduce((sum: number, e: any) => sum + Number(e.gross_revenue), 0);
  const totalRefunded = events.reduce((sum: number, e: any) => sum + Number(e.refunded_amount), 0);
  const totalNet = totalGross - totalRefunded;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Payout Overview</h1>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Gross Revenue', value: totalGross, color: '#6366f1' },
          { label: 'Refunded', value: totalRefunded, color: '#dc2626' },
          { label: 'Net Revenue', value: totalNet, color: '#16a34a' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: 8, padding: '16px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>
              KES {stat.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Per-event breakdown */}
      <h2>Per Event</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map((e: any) => {
          const gross = Number(e.gross_revenue);
          const refunded = Number(e.refunded_amount);
          const net = gross - refunded;
          return (
            <li key={e.id} style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{e.title}</strong>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    {new Date(e.start_at).toLocaleDateString()} — {e.status}
                  </div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    {e.paid_orders} paid order(s) · {e.refunded_orders} refunded
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
                    KES {net.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>net</div>
                  {refunded > 0 && (
                    <div style={{ fontSize: 12, color: '#dc2626' }}>
                      -{`KES ${refunded.toLocaleString()}`} refunded
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Link href={`/organizer/events/${e.id}/orders`} style={{ fontSize: 13, color: '#6366f1' }}>
                  View orders
                </Link>
              </div>
            </li>
          );
        })}
        {events.length === 0 && <p style={{ color: '#666' }}>No events yet.</p>}
      </ul>

      <p style={{ fontSize: 12, color: '#999', marginTop: 16 }}>
        Note: Paystack deducts transaction fees before settlement. Net revenue shown here is before Paystack fees.
      </p>
    </div>
  );
}
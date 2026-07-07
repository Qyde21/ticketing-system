import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const organizers = await sql`
    SELECT
      u.id, u.full_name, u.email, u.role,
      COALESCE(op.business_name, u.full_name) AS business_name,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'paid') AS paid_orders,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'refunded') AS refunded_orders,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross_revenue,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded_amount
    FROM users u
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    LEFT JOIN events e ON e.organizer_id = u.id
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE u.role IN ('organizer', 'admin')
    AND EXISTS (SELECT 1 FROM events WHERE organizer_id = u.id)
    GROUP BY u.id, u.full_name, u.email, u.role, op.business_name
    ORDER BY gross_revenue DESC
  `;

  const totalGross = organizers.reduce((sum: number, o: any) => sum + Number(o.gross_revenue), 0);
  const totalRefunded = organizers.reduce((sum: number, o: any) => sum + Number(o.refunded_amount), 0);
  const totalFees = totalGross * 0.10;
  const totalNet = totalGross - totalRefunded - totalFees;

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Platform Payouts</h1>

      {/* Platform summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
        {[
          { label: 'Total Gross Revenue', value: totalGross, color: '#6366f1' },
          { label: 'TicketHub Fees (10%)', value: totalFees, color: '#f59e0b' },
          { label: 'Total Refunded', value: totalRefunded, color: '#dc2626' },
          { label: 'Net to Organizers', value: totalNet, color: '#16a34a' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>
              KES {stat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Per organizer breakdown */}
      <h2>Per Organizer</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {organizers.map((o: any) => {
          const gross = Number(o.gross_revenue);
          const refunded = Number(o.refunded_amount);
          const fees = gross * 0.10;
          const net = gross - refunded - fees;
          return (
            <li key={o.id} style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ color: "#111827" }}>{o.business_name}</strong>
                  {o.role === 'admin' && (
                    <span style={{ marginLeft: 8, fontSize: 11, background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: 99, fontWeight: 700 }}>ADMIN</span>
                  )}
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{o.full_name} — {o.email}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    {o.paid_orders} paid · {o.refunded_orders} refunded
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
                    KES {net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>net payout</div>
                  <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                    KES {fees.toLocaleString(undefined, { maximumFractionDigits: 0 })} fees
                  </div>
                  <div style={{ fontSize: 12, color: '#6366f1', marginTop: 2 }}>
                    KES {gross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gross
                  </div>
                  {refunded > 0 && (
                    <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>
                      -KES {refunded.toLocaleString()} refunded
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {organizers.length === 0 && <p style={{ color: '#666' }}>No organizers yet.</p>}
      </ul>

      <p style={{ fontSize: 12, color: '#999', marginTop: 16 }}>
        Note: Paystack also deducts payment processing fees before settlement.
      </p>
    </div>
  );
}

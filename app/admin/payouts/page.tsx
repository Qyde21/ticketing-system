import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const organizers = await sql`
    SELECT
      u.id, u.full_name, u.email, op.business_name,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'paid') AS paid_orders,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'refunded') AS refunded_orders,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross_revenue,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded_amount
    FROM users u
    JOIN organizer_profiles op ON op.user_id = u.id
    LEFT JOIN events e ON e.organizer_id = u.id
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE u.role = 'organizer'
    GROUP BY u.id, u.full_name, u.email, op.business_name
    ORDER BY gross_revenue DESC
  `;

  const totalGross = organizers.reduce((sum: number, o: any) => sum + Number(o.gross_revenue), 0);
  const totalRefunded = organizers.reduce((sum: number, o: any) => sum + Number(o.refunded_amount), 0);
  const totalNet = totalGross - totalRefunded;
  const totalFees = totalGross * 0.10;

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Platform Payouts</h1>

      {/* Platform summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
        {[
          { label: 'Total Gross Revenue', value: totalGross, color: '#6366f1' },
          { label: 'TicketHub Fees (10%)', value: totalFees, color: '#f59e0b' },
          { label: 'Total Refunded', value: totalRefunded, color: '#dc2626' },
          { label: 'Net to Organizers', value: totalNet - totalFees, color: '#16a34a' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>
              KES {stat.value.toLocaleString()}
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
                  <strong>{o.business_name}</strong>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{o.full_name} — {o.email}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    {o.paid_orders} paid · {o.refunded_orders} refunded
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>KES {net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>net to organizer</div>
                  <div style={{ fontSize: 12, color: '#f59e0b' }}>KES {fees.toLocaleString(undefined, { maximumFractionDigits: 0 })} fees</div>
                  {refunded > 0 && <div style={{ fontSize: 12, color: '#dc2626' }}>-KES {refunded.toLocaleString()} refunded</div>}
                </div>
              </div>
            </li>
          );
        })}
        {organizers.length === 0 && <p style={{ color: '#666' }}>No organizers yet.</p>}
      </ul>
    </div>
  );
}
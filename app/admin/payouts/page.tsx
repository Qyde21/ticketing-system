import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const events = await sql`
    SELECT
      e.id, e.title, e.status, e.start_at,
      u.id AS organizer_id, u.full_name, u.email, u.role,
      COALESCE(op.business_name, u.full_name) AS business_name,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'paid') AS paid_orders,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'refunded') AS refunded_orders,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross_revenue,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded_amount
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE u.role IN ('organizer', 'admin')
    GROUP BY e.id, u.id, u.full_name, u.email, u.role, op.business_name
    ORDER BY u.full_name ASC, e.start_at DESC
  `;

  const totalGross = events.reduce((sum: number, e: any) => sum + Number(e.gross_revenue), 0);
  const totalRefunded = events.reduce((sum: number, e: any) => sum + Number(e.refunded_amount), 0);
  const totalFees = totalGross * 0.10;
  const totalNet = totalGross - totalRefunded - totalFees;

  const grouped: Record<string, any> = {};
  for (const e of events as any[]) {
    if (!grouped[e.organizer_id]) {
      grouped[e.organizer_id] = {
        full_name: e.full_name,
        email: e.email,
        role: e.role,
        business_name: e.business_name,
        events: [],
      };
    }
    grouped[e.organizer_id].events.push(e);
  }

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
      {Object.values(grouped).map((org: any) => {
        const orgGross = org.events.reduce((sum: number, e: any) => sum + Number(e.gross_revenue), 0);
        const orgRefunded = org.events.reduce((sum: number, e: any) => sum + Number(e.refunded_amount), 0);
        const orgFees = orgGross * 0.10;
        const orgNet = orgGross - orgRefunded - orgFees;

        return (
          <div key={org.email} style={{ background: '#fff', borderRadius: 8, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            {/* Organizer header */}
            <div style={{ background: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong style={{ color: '#111827' }}>{org.business_name}</strong>
                {org.role === 'admin' && <span style={{ marginLeft: 8, fontSize: 11, background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: 99, fontWeight: 700 }}>ADMIN</span>}
                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{org.full_name} — {org.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>KES {orgNet.toLocaleString(undefined, { maximumFractionDigits: 0 })} net</div>
                <div style={{ fontSize: 12, color: '#f59e0b' }}>KES {orgFees.toLocaleString(undefined, { maximumFractionDigits: 0 })} fees</div>
                <div style={{ fontSize: 12, color: '#6366f1' }}>KES {orgGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gross</div>
              </div>
            </div>

            {/* Per event rows */}
            {org.events.map((e: any) => {
              const gross = Number(e.gross_revenue);
              const refunded = Number(e.refunded_amount);
              const fees = gross * 0.10;
              const net = gross - refunded - fees;
              return (
                <div key={e.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {new Date(e.start_at).toLocaleDateString()} · {e.status} · {e.paid_orders} paid · {e.refunded_orders} refunded
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>KES {net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div style={{ fontSize: 11, color: '#f59e0b' }}>KES {fees.toLocaleString(undefined, { maximumFractionDigits: 0 })} fee</div>
                    {refunded > 0 && <div style={{ fontSize: 11, color: '#dc2626' }}>-KES {refunded.toLocaleString()} refunded</div>}
                    <div style={{ fontSize: 11, color: '#6b7280' }}>KES {gross.toLocaleString()} gross</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <p style={{ fontSize: 12, color: '#999', marginTop: 16 }}>
        Note: Paystack also deducts payment processing fees before settlement.
      </p>
    </div>
  );
}
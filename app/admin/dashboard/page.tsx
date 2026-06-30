import { sql } from '@/lib/db';
import Link from 'next/link';

export default async function AdminDashboard() {
  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'organizer') AS total_organizers,
      (SELECT COUNT(*) FROM events) AS total_events,
      (SELECT COUNT(*) FROM events WHERE status = 'published') AS published_events,
      (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS paid_orders,
      (SELECT COALESCE(SUM(total_amount_kes), 0) FROM orders WHERE payment_status = 'paid') AS total_revenue_kes
  `;

  const pendingOrganizers = await sql`
    SELECT u.id, u.full_name, u.email, op.business_name, op.created_at
    FROM organizer_profiles op
    JOIN users u ON u.id = op.user_id
    WHERE op.is_verified = false
    ORDER BY op.created_at ASC
  `;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto' }}>
      <h1>Admin Dashboard</h1>

      <h2>Platform Overview</h2>
      <ul>
        <li>Total users: {stats.total_users}</li>
        <li>Total organizers: {stats.total_organizers}</li>
        <li>Total events: {stats.total_events} ({stats.published_events} published)</li>
        <li>Paid orders: {stats.paid_orders}</li>
        <li>Total revenue: KES {Number(stats.total_revenue_kes).toLocaleString()}</li>
      </ul>

      <h2>Pending Organizer Approvals ({pendingOrganizers.length})</h2>
      {pendingOrganizers.length === 0 && <p>No pending approvals.</p>}
      <ul>
        {pendingOrganizers.map((o: any) => (
          <li key={o.id} style={{ marginBottom: 8 }}>
            {o.business_name} — {o.full_name} ({o.email})
            <ApproveButton userId={o.id} />
          </li>
        ))}
      </ul>

      <h2>All Events</h2>
      <Link href="/admin/events">View all events</Link>
    </div>
  );
}

import ApproveButton from './ApproveButton';
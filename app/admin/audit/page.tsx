import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');

  let rows: any[] = [];
  try {
    rows = (await sql`
      SELECT a.id, a.action, a.entity_type, a.entity_id, a.meta, a.created_at,
             u.full_name, u.email
      FROM admin_audit_log a
      LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `) as any[];
  } catch {
    rows = [];
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 text-white">
      <Link href="/admin/dashboard" className="text-sm text-indigo-400 hover:underline">&larr; Admin</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-2">Audit log</h1>
      <p className="text-gray-400 text-sm mb-6">Recent admin actions (approvals, refunds, payouts).</p>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No audit entries yet. Run migration 010 on Neon.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold text-amber-300">{r.action}</span>
                <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                {r.full_name || r.email || 'system'}
                {r.entity_type ? ` · ${r.entity_type}` : ''}
                {r.entity_id ? ` · ${r.entity_id}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

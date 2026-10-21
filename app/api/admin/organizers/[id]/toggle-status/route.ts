import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // An admin who suspends themselves, or another admin, locks the console
  // (sessions are re-checked on every request, so it takes effect at once).
  if (id === session.userId) {
    return NextResponse.json({ error: 'You cannot suspend your own account' }, { status: 400 });
  }

  try {
    // One atomic flip. Admin accounts are never touched by this endpoint, and an
    // unknown id used to report "success" while changing nothing (and still
    // wrote an audit entry).
    const [updated] = await sql`
      UPDATE users
      SET status = CASE WHEN status = 'suspended' THEN 'active' ELSE 'suspended' END
      WHERE id = ${id} AND role <> 'admin'
      RETURNING status
    `;

    if (!updated) {
      const [target] = await sql`SELECT role FROM users WHERE id = ${id}`;
      if (target?.role === 'admin') {
        return NextResponse.json({ error: 'Admin accounts cannot be suspended from here' }, { status: 403 });
      }
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await writeAuditLog({
      actorId: session.userId,
      action: 'organizer.toggle_status',
      entityType: 'user',
      entityId: id,
      meta: { newStatus: updated.status },
    });

    return NextResponse.json({ success: true, status: updated.status });
  } catch (err) {
    console.error('Toggle status error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

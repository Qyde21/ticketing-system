import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { processPayout } from '@/lib/payouts';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const result = await processPayout(id);

    await writeAuditLog({
      actorId: session.userId,
      action: 'payout.process',
      entityType: 'payout',
      entityId: id,
      meta: { status: result.status },
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 400 }
    );
  }
}

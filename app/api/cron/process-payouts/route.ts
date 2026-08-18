import { NextRequest, NextResponse } from 'next/server';
import {
  listAutoPayoutCandidates,
  queuePayoutForEvent,
  processPayout,
  computeNet,
  MIN_PAYOUT_KES,
} from '@/lib/payouts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidates = await listAutoPayoutCandidates(30);
  let paid = 0;
  let processing = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    try {
      const { net } = computeNet(Number(row.gross), Number(row.refunded));
      if (net < MIN_PAYOUT_KES) {
        skipped++;
        continue;
      }
      const { payoutId } = await queuePayoutForEvent(row.event_id as string);
      const result = await processPayout(payoutId);
      if (result.status === 'paid') paid++;
      else processing++;
    } catch (err: unknown) {
      failed++;
      errors.push(`${row.event_id}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    paid,
    processing,
    skipped,
    failed,
    errors: errors.slice(0, 10),
  });
}

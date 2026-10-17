import { NextRequest, NextResponse } from 'next/server';
import {
  listAutoPayoutCandidates,
  queuePayoutForEvent,
  processPayout,
  reconcileProcessingPayouts,
  computeNet,
  MIN_PAYOUT_KES,
} from '@/lib/payouts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
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

  // Follow up on transfers that were accepted but not yet final (M-Pesa
  // usually starts 'pending'). Runs after the loop so a transfer that just
  // failed is retried on the next daily run, not hammered immediately.
  let reconcile: Awaited<ReturnType<typeof reconcileProcessingPayouts>> | { error: string };
  try {
    reconcile = await reconcileProcessingPayouts(30);
  } catch (err: unknown) {
    reconcile = { error: err instanceof Error ? err.message : 'reconcile failed' };
  }

  return NextResponse.json({
    reconcile,
    candidates: candidates.length,
    paid,
    processing,
    skipped,
    failed,
    errors: errors.slice(0, 10),
  });
}

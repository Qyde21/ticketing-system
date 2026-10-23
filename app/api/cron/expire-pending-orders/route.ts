import { NextRequest, NextResponse } from 'next/server';
import { EXPIRY_MINUTES, expireStalePendingOrders } from '@/lib/expiry';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Backstop sweep. Checkout also releases stale holds for the ticket types
  // being bought, so this no longer decides how long seats stay held.
  const result = await expireStalePendingOrders({ limit: 200 });

  return NextResponse.json({ ok: true, expiryMinutes: EXPIRY_MINUTES, ...result });
}

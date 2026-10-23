import { NextRequest, NextResponse } from 'next/server';
import { reconcilePayments } from '@/lib/reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await reconcilePayments(process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin);
  return NextResponse.json({ ok: true, ...result });
}

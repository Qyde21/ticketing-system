import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getLoyaltySummary } from '@/lib/loyalty';

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await getLoyaltySummary(session.email);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('loyalty GET error:', err?.message || err);
    return NextResponse.json({ balance: 0, lifetimeEarned: 0, tier: 'Bronze' }, { status: 503 });
  }
}
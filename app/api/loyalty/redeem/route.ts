import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { redeemPointsForEvent, MIN_REDEMPTION_POINTS } from '@/lib/loyalty';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'Please log in to redeem points' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const eventId = String(body.eventId || '').trim();
  const points = Number(body.points);

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }
  if (!Number.isFinite(points) || points < MIN_REDEMPTION_POINTS) {
    return NextResponse.json(
      { error: `Minimum redemption is ${MIN_REDEMPTION_POINTS} points` },
      { status: 400 }
    );
  }

  try {
    const result = await redeemPointsForEvent(session.email, eventId, Math.floor(points));
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('loyalty redeem error:', err?.message || err);
    return NextResponse.json({ error: 'Could not redeem points right now. Try again shortly.' }, { status: 503 });
  }
}
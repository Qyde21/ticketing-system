import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { queuePayoutForEvent, processPayout, getEventEarnings } from '@/lib/payouts';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const rows = await sql`
    SELECT p.id, p.event_id, p.gross_kes, p.refunded_kes, p.platform_fee_kes, p.net_kes,
           p.status, p.failure_reason, p.requested_at, p.paid_at, e.title AS event_title
    FROM organizer_payouts p
    JOIN events e ON e.id = p.event_id
    WHERE p.organizer_id = ${session.userId}
    ORDER BY p.requested_at DESC
    LIMIT 50
  `;
  return NextResponse.json({ payouts: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const eventId = body.eventId as string;
    const doProcess = body.process !== false;
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const [event] = await sql`SELECT id, organizer_id FROM events WHERE id = ${eventId}`;
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.organizer_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Not your event' }, { status: 403 });
    }

    const earnings = await getEventEarnings(eventId);
    if (!earnings) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { payoutId } = await queuePayoutForEvent(eventId);
    let result: { status: string } = { status: 'pending' };
    if (doProcess) {
      result = await processPayout(payoutId);
    }
    return NextResponse.json({ payoutId, ...result, net: earnings.net });
  } catch (err: unknown) {
    console.error('payout request:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payout failed' },
      { status: 400 }
    );
  }
}

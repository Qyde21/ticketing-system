import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendEventReminderEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Remind buyers whose event starts roughly "tomorrow" - a wide window
  // (18h to 30h out) makes this safe to run once daily without missing
  // events due to slight timing drift. reminder_sent_at prevents duplicates.
  const windowStart = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();

  const orders = await sql`
    SELECT o.id, o.buyer_name, o.buyer_email, o.quantity,
           e.title AS event_title, e.venue_name, e.start_at
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE o.payment_status = 'paid'
    AND o.reminder_sent_at IS NULL
    AND e.status NOT IN ('cancelled')
    AND e.start_at BETWEEN ${windowStart} AND ${windowEnd}
  `;

  let sent = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      await sendEventReminderEmail({
        toEmail: order.buyer_email,
        buyerName: order.buyer_name,
        eventTitle: order.event_title,
        venueName: order.venue_name,
        startAt: order.start_at,
        quantity: order.quantity,
      });
      await sql`UPDATE orders SET reminder_sent_at = now() WHERE id = ${order.id}`;
      sent++;
    } catch (err) {
      console.error('Failed to send reminder for order', order.id, err);
      failed++;
    }
  }

  return NextResponse.json({ checked: orders.length, sent, failed });
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendShiftReminderEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/** Remind staff whose shift starts in the next 1–2 hours */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  const rows = await sql`
    SELECT
      a.user_id,
      u.full_name,
      u.email,
      s.id AS shift_id,
      s.name AS shift_name,
      s.starts_at,
      s.ends_at,
      s.gate,
      s.event_id,
      e.title AS event_title
    FROM event_shift_assignments a
    JOIN event_shifts s ON s.id = a.shift_id
    JOIN events e ON e.id = s.event_id
    JOIN users u ON u.id = a.user_id
    WHERE s.starts_at > now()
      AND s.starts_at <= now() + interval '2 hours'
      AND e.status = 'published'
  `;

  let sent = 0;
  for (const r of rows as any[]) {
    try {
      await sendShiftReminderEmail({
        toEmail: r.email,
        staffName: r.full_name || 'there',
        eventTitle: r.event_title,
        shiftName: r.shift_name,
        startsAt: String(r.starts_at),
        endsAt: String(r.ends_at),
        gate: r.gate,
        scanUrl: `${origin}/scan/${r.event_id}`,
      });
      sent += 1;
    } catch (err) {
      console.error('Shift reminder failed', r.email, err);
    }
  }

  return NextResponse.json({ ok: true, candidates: rows.length, sent });
}
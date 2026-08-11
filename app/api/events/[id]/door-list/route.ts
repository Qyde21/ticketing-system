import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;

  const [event] = await sql`
    SELECT id, title, organizer_id, start_at
    FROM events
    WHERE id = ${eventId}
  `;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
  }

  const rows = await sql`
    SELECT
      t.ticket_code,
      t.holder_name,
      t.holder_email,
      t.status AS ticket_status,
      t.checked_in_at,
      tt.name AS ticket_type,
      o.buyer_name,
      o.buyer_email,
      o.buyer_phone,
      o.paystack_reference,
      o.payment_status,
      o.created_at AS purchased_at
    FROM tickets t
    JOIN orders o ON o.id = t.order_id
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    WHERE o.event_id = ${eventId}
      AND o.payment_status IN ('paid', 'refunded')
    ORDER BY
      CASE t.status WHEN 'used' THEN 0 WHEN 'valid' THEN 1 ELSE 2 END,
      tt.name ASC,
      t.holder_name ASC NULLS LAST,
      t.ticket_code ASC
  `;

  const headers = [
    'ticket_code',
    'holder_name',
    'holder_email',
    'ticket_type',
    'ticket_status',
    'checked_in_at',
    'buyer_name',
    'buyer_email',
    'buyer_phone',
    'payment_status',
    'paystack_reference',
    'purchased_at',
  ];

  const lines = [headers.join(',')];
  for (const r of rows as any[]) {
    lines.push(
      [
        csvEscape(r.ticket_code),
        csvEscape(r.holder_name),
        csvEscape(r.holder_email),
        csvEscape(r.ticket_type),
        csvEscape(r.ticket_status),
        csvEscape(r.checked_in_at ? new Date(r.checked_in_at).toISOString() : ''),
        csvEscape(r.buyer_name),
        csvEscape(r.buyer_email),
        csvEscape(r.buyer_phone),
        csvEscape(r.payment_status),
        csvEscape(r.paystack_reference),
        csvEscape(r.purchased_at ? new Date(r.purchased_at).toISOString() : ''),
      ].join(',')
    );
  }

  const csv = lines.join('\r\n') + '\r\n';
  const safeTitle = String(event.title || 'event')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);
  const filename = `door-list-${safeTitle || eventId}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decodedId = decodeURIComponent(id);
  const events = await sql`
    SELECT id, title, organizer_id FROM events
    WHERE id::text = ${decodedId} OR slug = ${decodedId.toLowerCase()} OR title ILIKE ${decodedId}
  `;
  const event = events[0];

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Only the organizer who owns this event, or an admin, can export it.
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
  }

  const orders = await sql`
    SELECT
      o.id,
      o.buyer_name,
      o.buyer_email,
      o.buyer_phone,
      t.name AS ticket_name,
      o.quantity,
      o.total_amount_kes,
      o.payment_status,
      o.paystack_reference,
      o.created_at
    FROM orders o
    LEFT JOIN ticket_types t ON t.id = o.ticket_type_id
    WHERE o.event_id = ${event.id}
    ORDER BY o.created_at DESC
  `;

  const headers = [
    'Order ID',
    'Buyer Name',
    'Buyer Email',
    'Buyer Phone',
    'Ticket Type',
    'Quantity',
    'Total (KES)',
    'Payment Status',
    'Payment Reference',
    'Created At',
  ];

  const rows = orders.map((o: any) => [
    o.id,
    o.buyer_name,
    o.buyer_email,
    o.buyer_phone,
    o.ticket_name,
    o.quantity,
    o.total_amount_kes,
    o.payment_status,
    o.paystack_reference,
    o.created_at ? new Date(o.created_at).toISOString() : '',
  ]);

  const csvLines = [headers, ...rows].map((row) => row.map(csvEscape).join(','));
  const csv = csvLines.join('\r\n');

  const safeTitle = (event.title || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${safeTitle}.csv"`,
    },
  });
}

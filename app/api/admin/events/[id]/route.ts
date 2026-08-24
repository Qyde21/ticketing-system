import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const force = request.nextUrl.searchParams.get('force') === '1';

    const [event] = await sql`SELECT id, title, status FROM events WHERE id = ${id}`;
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const [{ paid_count }] = await sql`
      SELECT COUNT(*)::int AS paid_count
      FROM orders
      WHERE event_id = ${id} AND payment_status = 'paid'
    `;

    if (Number(paid_count) > 0 && !force) {
      return NextResponse.json(
        {
          error: `This event has ${paid_count} paid order(s). Cancel it first, or delete with force if you are sure.`,
          paidCount: paid_count,
          needsForce: true,
        },
        { status: 400 }
      );
    }

    const orders = await sql`SELECT id FROM orders WHERE event_id = ${id}`;
    for (const order of orders) {
      await sql`DELETE FROM payment_events WHERE order_id = ${order.id}`;
      await sql`DELETE FROM tickets WHERE order_id = ${order.id}`;
    }

    await sql`DELETE FROM messages WHERE event_id = ${id}`;
    await sql`DELETE FROM orders WHERE event_id = ${id}`;
    await sql`DELETE FROM event_staff WHERE event_id = ${id}`;

    try {
      await sql`DELETE FROM waitlist_entries WHERE ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id = ${id})`;
    } catch {
      /* table may not exist */
    }
    try {
      await sql`DELETE FROM promo_codes WHERE event_id = ${id}`;
    } catch {
      /* may not exist on older schema */
    }

    await sql`DELETE FROM ticket_types WHERE event_id = ${id}`;
    await sql`DELETE FROM events WHERE id = ${id}`;

    return NextResponse.json({ success: true, deleted: event.title });
  } catch (error: any) {
    console.error('Admin delete event error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete event' },
      { status: 500 }
    );
  }
}

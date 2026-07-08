import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  const [event] = await sql`SELECT id, status FROM events WHERE id = ${id}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.status !== 'cancelled') {
    return NextResponse.json({ error: 'Only cancelled events can be deleted' }, { status: 400 });
  }

  const orders = await sql`SELECT id FROM orders WHERE event_id = ${id}`;
  for (const order of orders) {
    await sql`DELETE FROM payment_events WHERE order_id = ${order.id}`;
    await sql`DELETE FROM tickets WHERE order_id = ${order.id}`;
  }

  await sql`DELETE FROM messages WHERE event_id = ${id}`;
  await sql`DELETE FROM orders WHERE event_id = ${id}`;
  await sql`DELETE FROM event_staff WHERE event_id = ${id}`;
  await sql`DELETE FROM ticket_types WHERE event_id = ${id}`;
  await sql`DELETE FROM events WHERE id = ${id}`;

  return NextResponse.json({ success: true });
}
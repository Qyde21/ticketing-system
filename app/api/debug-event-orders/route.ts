import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const events = await sql`SELECT * FROM events WHERE id = ${id}`;
    const orders = await sql`SELECT * FROM orders WHERE event_id = ${id}`;
    return NextResponse.json({ eventId: id, eventFound: events, ordersFound: orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
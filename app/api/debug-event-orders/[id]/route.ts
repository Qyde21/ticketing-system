import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    
    const events = await sql`SELECT * FROM events WHERE id::text = ${decodedId} OR title ILIKE ${'%' + decodedId + '%'}`;
    const orders = await sql`SELECT * FROM orders`;
    
    return NextResponse.json({ queryId: decodedId, eventFound: events, totalOrdersInDb: orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
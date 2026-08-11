import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  const [event] = await sql`SELECT organizer_id, status FROM events WHERE id = ${id}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (event.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft events can be submitted or published' }, { status: 400 });
  }

  const newStatus = session.role === 'admin' ? 'published' : 'pending_review';

  const [updated] = await sql`
    UPDATE events SET status = ${newStatus}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, status
  `;

  revalidateTag('events');
  return NextResponse.json({ event: updated });
}
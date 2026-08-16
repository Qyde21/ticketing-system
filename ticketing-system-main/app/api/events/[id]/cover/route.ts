import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  const [event] = await sql`SELECT id, organizer_id FROM events WHERE id = ${id}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { coverImageUrl } = await req.json();
  if (!coverImageUrl) {
    return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
  }

  await sql`
    UPDATE events SET cover_image_url = ${coverImageUrl}, updated_at = now()
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true });
}

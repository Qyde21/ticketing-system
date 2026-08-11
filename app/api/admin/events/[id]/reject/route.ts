import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEventRejectedEmail } from '@/lib/email';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body?.reason;
  } catch {
    // No body sent is fine - reason is optional
  }

  const [event] = await sql`
    SELECT e.id, e.title, e.status, u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.id = ${id}
  `;

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.status !== 'pending_review') {
    return NextResponse.json({ error: 'Only events pending review can be rejected' }, { status: 400 });
  }

  await sql`UPDATE events SET status = 'draft', updated_at = now() WHERE id = ${id}`;

  try {
    await sendEventRejectedEmail({
      toEmail: event.organizer_email,
      organizerName: event.organizer_name,
      eventTitle: event.title,
      reason,
    });
  } catch (emailErr) {
    console.error('Failed to send event rejection email:', emailErr);
  }

  revalidateTag('events', 'max');
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { sendEventApprovedEmail } from '@/lib/email';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const [event] = await sql`
    SELECT e.id, e.title, e.slug, e.status, u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.id = ${id}
  `;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.status !== 'pending_review') {
    return NextResponse.json({ error: 'Only events pending review can be approved' }, { status: 400 });
  }

  // Claim atomically: a double-click or two admins at once must not both
  // approve (and email the organizer) twice.
  const [claimed] = await sql`
    UPDATE events SET status = 'published', updated_at = now()
    WHERE id = ${id} AND status = 'pending_review'
    RETURNING id
  `;
  if (!claimed) {
    return NextResponse.json({ error: 'Only events pending review can be approved' }, { status: 400 });
  }

  try {
    await sendEventApprovedEmail({
      toEmail: event.organizer_email,
      organizerName: event.organizer_name,
      eventTitle: event.title,
      eventUrl: `${req.nextUrl.origin}/events/${event.slug || event.id}`,
    });
  } catch (emailErr) {
    console.error('Failed to send event approval email:', emailErr);
  }

  revalidateTag('events', 'max');

  await writeAuditLog({
    actorId: session?.userId,
    action: 'event.approve',
    entityType: 'event',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}

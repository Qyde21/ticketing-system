import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEventApprovedEmail } from '@/lib/email';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;

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

  await sql`UPDATE events SET status = 'published', updated_at = now() WHERE id = ${id}`;

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

  return NextResponse.json({ success: true });
}

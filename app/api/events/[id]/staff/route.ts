import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendDoorStaffInviteEmail } from '@/lib/email';

function isEventEnded(event: { status?: string; start_at?: string | Date; end_at?: string | Date | null }) {
  if (event.status === 'completed' || event.status === 'cancelled') return true;
  const end = event.end_at ? new Date(event.end_at) : event.start_at ? new Date(event.start_at) : null;
  return !!end && end < new Date();
}

async function assertOrganizerOrAdmin(eventId: string, userId: string, role: string) {
  const [event] = await sql`
    SELECT id, title, organizer_id, status, start_at, end_at FROM events WHERE id = ${eventId}
  `;
  if (!event) return { error: 'Event not found', status: 404 as const };
  if (event.organizer_id !== userId && role !== 'admin') {
    return { error: 'Not authorized for this event', status: 403 as const };
  }
  return { event };
}

function parseEmails(body: any): string[] {
  const raw: string[] = [];
  if (Array.isArray(body.emails)) {
    for (const e of body.emails) raw.push(String(e || ''));
  }
  if (body.email) raw.push(String(body.email));
  if (typeof body.emailsText === 'string') {
    raw.push(...body.emailsText.split(/[\s,;]+/));
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of raw) {
    const email = e.trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

type InviteResult = {
  email: string;
  status: 'added' | 'already_staff' | 'resent' | 'not_found' | 'suspended' | 'is_organizer' | 'error';
  message?: string;
  staff?: { id: string; full_name: string; email: string };
  emailSent?: boolean;
};

async function inviteOne(
  eventId: string,
  event: { id: string; title: string; organizer_id: string },
  email: string,
  origin: string,
  opts: { resendOnly?: boolean } = {}
): Promise<InviteResult> {
  const [user] = await sql`
    SELECT id, full_name, email, status FROM users WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (!user) {
    return {
      email,
      status: 'not_found',
      message: 'No TicketHub account found. Ask them to sign up first, then invite again.',
    };
  }
  if (user.status === 'suspended') {
    return { email, status: 'suspended', message: 'That account is suspended' };
  }
  if (user.id === event.organizer_id) {
    return {
      email,
      status: 'is_organizer',
      message: 'The organizer already has full access to this event',
    };
  }

  const existing = await sql`
    SELECT event_id FROM event_staff
    WHERE event_id = ${eventId} AND user_id = ${user.id}
    LIMIT 1
  `;
  const staff = { id: user.id as string, full_name: user.full_name as string, email: user.email as string };

  async function sendInviteEmail(): Promise<boolean> {
    try {
      const scanUrl = `${origin}/scan/${eventId}`;
      const loginUrl = `${origin}/login`;
      await sendDoorStaffInviteEmail({
        toEmail: staff.email,
        staffName: staff.full_name || staff.email,
        eventTitle: event.title as string,
        scanUrl,
        loginUrl,
      });
      return true;
    } catch (err) {
      console.error('Door staff invite email failed:', err);
      return false;
    }
  }

  if (existing.length > 0) {
    if (opts.resendOnly) {
      const emailSent = await sendInviteEmail();
      return {
        email,
        status: 'resent',
        message: emailSent ? 'Invite email resent' : 'Resend failed — email could not be sent',
        staff,
        emailSent,
      };
    }
    return {
      email,
      status: 'already_staff',
      message: 'Already door staff for this event',
      staff,
    };
  }

  if (opts.resendOnly) {
    return {
      email,
      status: 'not_found',
      message: 'That person is not on the door staff list',
    };
  }

  await sql`
    INSERT INTO event_staff (event_id, user_id)
    VALUES (${eventId}, ${user.id})
  `;

  const emailSent = await sendInviteEmail();
  return { email, status: 'added', staff, emailSent };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: eventId } = await params;
  const check = await assertOrganizerOrAdmin(eventId, session.userId, session.role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const staff = await sql`
    SELECT u.id, u.full_name, u.email
    FROM event_staff es
    JOIN users u ON u.id = es.user_id
    WHERE es.event_id = ${eventId}
    ORDER BY u.full_name ASC
  `;
  return NextResponse.json({ staff });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: eventId } = await params;
  const check = await assertOrganizerOrAdmin(eventId, session.userId, session.role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });
  if (isEventEnded(check.event)) {
    return NextResponse.json({ error: 'This event has ended. Door staff changes are closed.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const emails = parseEmails(body);
  if (emails.length === 0) {
    return NextResponse.json({ error: 'At least one valid email is required' }, { status: 400 });
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 emails per request' }, { status: 400 });
  }

  const origin = req.nextUrl.origin || 'https://www.mytickethub.co.ke';
  const results: InviteResult[] = [];
  for (const email of emails) {
    try {
      const resendOnly = body.resend === true || body.action === 'resend';
      results.push(await inviteOne(eventId, check.event as any, email, origin, { resendOnly }));
    } catch (err) {
      console.error('Invite failed for', email, err);
      results.push({ email, status: 'error', message: 'Something went wrong for this email' });
    }
  }

  const added = results.filter((r) => r.status === 'added').map((r) => r.staff!).filter(Boolean);
  const summary = {
    added: results.filter((r) => r.status === 'added').length,
    alreadyStaff: results.filter((r) => r.status === 'already_staff').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    failed: results.filter((r) => ['suspended', 'is_organizer', 'error'].includes(r.status)).length,
    emailsSent: results.filter((r) => r.emailSent).length,
  };

  if (emails.length === 1) {
    const r = results[0];
    if (r.status === 'added' || r.status === 'resent') {
      return NextResponse.json({
        success: true,
        staff: r.staff,
        emailSent: r.emailSent,
        resent: r.status === 'resent',
        results,
        summary,
      });
    }
    if (r.status === 'already_staff') {
      return NextResponse.json(
        {
          error: r.message,
          alreadyStaff: true,
          staff: r.staff,
          results,
          summary,
        },
        { status: 409 }
      );
    }
    if (r.status === 'not_found') {
      return NextResponse.json({ error: r.message, results, summary }, { status: 404 });
    }
    return NextResponse.json({ error: r.message || 'Could not add staff', results, summary }, { status: 400 });
  }

  return NextResponse.json({ success: true, results, summary, added });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: eventId } = await params;
  const check = await assertOrganizerOrAdmin(eventId, session.userId, session.role);
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });
  if (isEventEnded(check.event)) {
    return NextResponse.json({ error: 'This event has ended. Door staff changes are closed.' }, { status: 400 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await sql`
    DELETE FROM event_staff WHERE event_id = ${eventId} AND user_id = ${userId}
  `;
  return NextResponse.json({ success: true });
}
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Resend } from 'resend';

function getResend() { if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set"); return new Resend(process.env.RESEND_API_KEY); }

// Escapes text before it's interpolated into an HTML email â€” message body,
// names, and event titles are all ultimately user-supplied, so without this
// a message could inject markup or deceptive links into the recipient's
// notification email.
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { eventId, recipientId, body, isBroadcast } = await req.json();

  if (!eventId || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const [event] = await sql`SELECT id, title, organizer_id FROM events WHERE id = ${eventId}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const isOrganizer = session.userId === event.organizer_id || session.role === 'admin';

  if (isBroadcast && !isOrganizer) {
    return NextResponse.json({ error: 'Only organizers can send broadcast messages' }, { status: 403 });
  }

  if (isBroadcast) {
    const buyers = await sql`
      SELECT DISTINCT u.id, u.email, u.full_name
      FROM orders o
      JOIN users u ON u.email = o.buyer_email
      WHERE o.event_id = ${eventId} AND o.payment_status = 'paid'
    `;

    for (const buyer of buyers) {
      await sql`
        INSERT INTO messages (event_id, sender_id, recipient_id, body, is_broadcast)
        VALUES (${eventId}, ${session.userId}, ${buyer.id}, ${body}, true)
      `;

      try {
        await getResend().emails.send({
          from: 'TicketHub <noreply@mytickethub.co.ke>',
          to: buyer.email,
          subject: `Message from organizer - ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>Message about ${escapeHtml(event.title)}</h2>
              <p>Hi ${escapeHtml(buyer.full_name)},</p>
              <p>${escapeHtml(body)}</p>
              <p style="color: #888; font-size: 12px; margin-top: 24px;">
                You can reply to this message by visiting your TicketHub inbox.
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.error('Failed to send email to', buyer.email, err);
      }
    }

    return NextResponse.json({ success: true, sent: buyers.length });
  }

  if (!recipientId) {
    return NextResponse.json({ error: 'Recipient required for direct messages' }, { status: 400 });
  }

  if (isOrganizer) {
    // Organizer/admin can only message actual paid buyers of this event.
    const [buyerMatch] = await sql`
      SELECT 1 FROM orders o
      JOIN users u ON u.email = o.buyer_email
      WHERE o.event_id = ${eventId} AND o.payment_status = 'paid' AND u.id = ${recipientId}
      LIMIT 1
    `;
    if (!buyerMatch) {
      return NextResponse.json({ error: 'Recipient is not a buyer of this event' }, { status: 403 });
    }
  } else {
    // Sender must be a paid buyer of this event, and can only message its organizer or an admin.
    const senderEmail = session.email.toLowerCase();
    const [buyerCheck] = await sql`
      SELECT 1 FROM orders
      WHERE event_id = ${eventId} AND payment_status = 'paid' AND LOWER(buyer_email) = ${senderEmail}
      LIMIT 1
    `;
    if (!buyerCheck) {
      return NextResponse.json({ error: 'You are not authorized to message about this event' }, { status: 403 });
    }

    const [recipientUser] = await sql`SELECT id, role FROM users WHERE id = ${recipientId}`;
    const recipientIsOrganizerOrAdmin = !!recipientUser && (recipientId === event.organizer_id || recipientUser.role === 'admin');
    if (!recipientIsOrganizerOrAdmin) {
      return NextResponse.json({ error: 'You can only message the event organizer' }, { status: 403 });
    }
  }

  await sql`
    INSERT INTO messages (event_id, sender_id, recipient_id, body, is_broadcast)
    VALUES (${eventId}, ${session.userId}, ${recipientId}, ${body}, false)
  `;

  const [recipient] = await sql`SELECT email, full_name FROM users WHERE id = ${recipientId}`;
  const [sender] = await sql`SELECT full_name FROM users WHERE id = ${session.userId}`;

  try {
    await getResend().emails.send({
      from: 'TicketHub <noreply@mytickethub.co.ke>',
      to: recipient.email,
      subject: `New message about ${event.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>New message about ${escapeHtml(event.title)}</h2>
          <p>Hi ${escapeHtml(recipient.full_name)},</p>
          <p><strong>${escapeHtml(sender.full_name)}</strong> sent you a message:</p>
          <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #374151;">${escapeHtml(body)}</blockquote>
          <p>Log in to TicketHub to reply.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send message email:', err);
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');

  if (eventId) {
    const messages = await sql`
      SELECT m.id, m.body, m.is_broadcast, m.created_at,
             u.full_name AS sender_name, u.id AS sender_id,
             r.full_name AS recipient_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN users r ON r.id = m.recipient_id
      WHERE m.event_id = ${eventId}
      AND (m.sender_id = ${session.userId} OR m.recipient_id = ${session.userId} OR m.is_broadcast = true)
      ORDER BY m.created_at ASC
    `;
    return NextResponse.json({ messages });
  }

  const messages = await sql`
    SELECT m.id, m.body, m.is_broadcast, m.created_at, m.event_id,
           u.full_name AS sender_name, u.id AS sender_id,
           e.title AS event_title
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    JOIN events e ON e.id = m.event_id
    WHERE m.recipient_id = ${session.userId}
    ORDER BY m.created_at DESC
  `;

  return NextResponse.json({ messages });
}

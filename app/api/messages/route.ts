import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
        await resend.emails.send({
          from: 'TicketHub <onboarding@resend.dev>',
          to: buyer.email,
          subject: `Message from organizer — ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>Message about ${event.title}</h2>
              <p>Hi ${buyer.full_name},</p>
              <p>${body}</p>
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

  await sql`
    INSERT INTO messages (event_id, sender_id, recipient_id, body, is_broadcast)
    VALUES (${eventId}, ${session.userId}, ${recipientId}, ${body}, false)
  `;

  const [recipient] = await sql`SELECT email, full_name FROM users WHERE id = ${recipientId}`;
  const [sender] = await sql`SELECT full_name FROM users WHERE id = ${session.userId}`;

  try {
    await resend.emails.send({
      from: 'TicketHub <onboarding@resend.dev>',
      to: recipient.email,
      subject: `New message about ${event.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>New message about ${event.title}</h2>
          <p>Hi ${recipient.full_name},</p>
          <p><strong>${sender.full_name}</strong> sent you a message:</p>
          <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #374151;">${body}</blockquote>
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
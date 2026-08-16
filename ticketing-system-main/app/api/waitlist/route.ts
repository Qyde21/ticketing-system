import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendWaitlistConfirmationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { ticketTypeId, name, email } = await req.json();

    if (!ticketTypeId || !name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const [ticketType] = await sql`
      SELECT tt.id, tt.name AS ticket_type_name, e.title AS event_title
      FROM ticket_types tt
      JOIN events e ON e.id = tt.event_id
      WHERE tt.id = ${ticketTypeId}
    `;

    if (!ticketType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
    }

    try {
      await sql`
        INSERT INTO waitlist_entries (ticket_type_id, name, email)
        VALUES (${ticketTypeId}, ${name}, ${normalizedEmail})
      `;
    } catch (dbErr: any) {
      if (dbErr.message && dbErr.message.includes('duplicate key')) {
        return NextResponse.json({ success: true, message: "You're already on the waitlist for this ticket." });
      }
      throw dbErr;
    }

    try {
      await sendWaitlistConfirmationEmail({
        toEmail: normalizedEmail,
        name,
        eventTitle: ticketType.event_title,
        ticketTypeName: ticketType.ticket_type_name,
      });
    } catch (emailErr) {
      console.error('Failed to send waitlist confirmation email:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Waitlist signup error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

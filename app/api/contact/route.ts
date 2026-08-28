import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResend() { if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set"); return new Resend(process.env.RESEND_API_KEY); }

// Escapes user-supplied text before it's interpolated into an HTML email —
// these fields are attacker-controlled input, so without this a submitted
// name/message could inject markup or deceptive links into the email your
// support inbox (and the sender's own auto-reply) renders.
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    await getResend().emails.send({
      from: 'TicketHub <noreply@mytickethub.co.ke>',
      to: 'tickethub199@gmail.com',
      replyTo: email,
      subject: 'Contact Form: ' + subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>New contact form submission</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #374151;">${safeMessage}</blockquote>
        </div>
      `,
    });

    await getResend().emails.send({
      from: 'TicketHub <noreply@mytickethub.co.ke>',
      to: email,
      subject: 'We received your message - TicketHub',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Thanks for reaching out, ${safeName}!</h2>
          <p>We received your message about <strong>${safeSubject}</strong> and will get back to you within 24 hours.</p>
          <p>In the meantime, you can also reach us instantly on WhatsApp: <a href="https://wa.me/254114525941">+254 114 525 941</a></p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

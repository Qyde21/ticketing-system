import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await resend.emails.send({
      from: 'TicketHub <onboarding@resend.dev>',
      to: 'support@tickethub.co.ke',
      replyTo: email,
      subject: 'Contact Form: ' + subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>New contact form submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #374151;">${message}</blockquote>
        </div>
      `,
    });

    await resend.emails.send({
      from: 'TicketHub <onboarding@resend.dev>',
      to: email,
      subject: 'We received your message — TicketHub',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Thanks for reaching out, ${name}!</h2>
          <p>We received your message about <strong>${subject}</strong> and will get back to you within 24 hours.</p>
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
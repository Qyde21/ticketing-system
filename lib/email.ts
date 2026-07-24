import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTicketEmail(params: {
  toEmail: string;
  buyerName: string;
  eventTitle: string;
  venueName: string;
  startAt: string;
  ticketCodes: string[];
  baseUrl: string;
}) {
  const ticketLinks = params.ticketCodes
    .map((code) => `<li><a href="${params.baseUrl}/tickets/${code}">${code}</a></li>`)
    .join('');

  await resend.emails.send({
    from: 'TicketHub <onboarding@resend.dev>',
    to: params.toEmail,
    subject: `Your ticket${params.ticketCodes.length > 1 ? 's' : ''} for ${params.eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You are going to ${params.eventTitle}!</h2>
        <p>Hi ${params.buyerName},</p>
        <p>Your payment was successful. Here ${params.ticketCodes.length > 1 ? 'are your tickets' : 'is your ticket'}:</p>
        <ul>${ticketLinks}</ul>
        <p><strong>Venue:</strong> ${params.venueName}<br/>
        <strong>Date:</strong> ${new Date(params.startAt).toLocaleString()}</p>
        <p>Click your ticket link above to view your QR code - show it at the entrance for check-in.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendCancellationEmail(params: {
  toEmail: string;
  buyerName: string;
  eventTitle: string;
  reason: string;
}) {
  await resend.emails.send({
    from: 'TicketHub <onboarding@resend.dev>',
    to: params.toEmail,
    subject: `${params.eventTitle} - Order cancelled and refunded`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your order has been cancelled</h2>
        <p>Hi ${params.buyerName},</p>
        <p>${params.reason}</p>
        <p>Your payment is being refunded and should reflect in 5-10 business days, depending on your payment method.</p>
        <p>We are sorry for the inconvenience.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  resetUrl: string;
}) {
  await resend.emails.send({
    from: 'TicketHub <onboarding@resend.dev>',
    to: params.toEmail,
    subject: 'Reset your TicketHub password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>We received a request to reset the password for this account.</p>
        <p><a href="${params.resetUrl}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reset Password</a></p>
        <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email - your password will not be changed.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

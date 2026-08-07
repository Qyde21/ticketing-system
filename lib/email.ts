import { Resend } from 'resend';

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendTicketEmail(params: {
  toEmail: string;
  buyerName: string;
  eventTitle: string;
  venueName: string;
  startAt: string;
  ticketCodes: string[];
  baseUrl: string;
}) {
  const resend = getResend();
  const ticketLinks = params.ticketCodes
    .map((code) => `<li><a href="${params.baseUrl}/tickets/${code}">${code}</a></li>`)
    .join('');
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
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
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
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

export async function sendVerificationEmail(params: {
  toEmail: string;
  fullName: string;
  verifyUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: 'Confirm your TicketHub account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to TicketHub, ${params.fullName}!</h2>
        <p>Please confirm your email address to activate your account.</p>
        <p><a href="${params.verifyUrl}" style="display: inline-block; background: #059669; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Confirm Email Address</a></p>
        <p>This link will expire in 24 hours. If you did not create this account, you can safely ignore this email.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  resetUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
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

export async function sendTicketTransferredToNewHolderEmail(params: {
  toEmail: string;
  newHolderName: string;
  fromName: string;
  eventTitle: string;
  venueName: string;
  startAt: string;
  ticketCode: string;
  baseUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: `${params.fromName} sent you a ticket for ${params.eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've received a ticket!</h2>
        <p>Hi ${params.newHolderName},</p>
        <p>${params.fromName} has transferred their ticket for <strong>${params.eventTitle}</strong> to you.</p>
        <p><strong>Venue:</strong> ${params.venueName}<br/>
        <strong>Date:</strong> ${new Date(params.startAt).toLocaleString()}</p>
        <p><a href="${params.baseUrl}/tickets/${params.ticketCode}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Your Ticket</a></p>
        <p>Show this QR code at the entrance for check-in.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendTicketTransferConfirmationEmail(params: {
  toEmail: string;
  originalHolderName: string;
  newHolderName: string;
  newHolderEmail: string;
  eventTitle: string;
  ticketCode: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: `Ticket transferred for ${params.eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Ticket transfer confirmed</h2>
        <p>Hi ${params.originalHolderName},</p>
        <p>Your ticket for <strong>${params.eventTitle}</strong> has been successfully transferred to ${params.newHolderName} (${params.newHolderEmail}).</p>
        <p>This ticket is no longer valid for your entry - the new holder will use it to check in at the event.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendWaitlistConfirmationEmail(params: {
  toEmail: string;
  name: string;
  eventTitle: string;
  ticketTypeName: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: `You're on the waitlist for ${params.eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're on the waitlist!</h2>
        <p>Hi ${params.name},</p>
        <p>The <strong>${params.ticketTypeName}</strong> tier for <strong>${params.eventTitle}</strong> is currently sold out, but you've been added to the waitlist.</p>
        <p>If a spot opens up (for example from a cancellation), we'll email you right away with a link to buy - on a first-come, first-served basis, so keep an eye on your inbox.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendWaitlistSpotAvailableEmail(params: {
  toEmail: string;
  name: string;
  eventTitle: string;
  ticketTypeName: string;
  checkoutUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: `A spot just opened up for ${params.eventTitle}!`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>A spot just opened up!</h2>
        <p>Hi ${params.name},</p>
        <p>Good news - a <strong>${params.ticketTypeName}</strong> ticket for <strong>${params.eventTitle}</strong> just became available. You're on the waitlist, so you're getting first chance at it.</p>
        <p><a href="${params.checkoutUrl}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Buy Now</a></p>
        <p>This is first-come, first-served, so grab it soon before it's gone again.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendEventReminderEmail(params: {
  toEmail: string;
  buyerName: string;
  eventTitle: string;
  venueName: string;
  startAt: string;
  quantity: number;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: `Reminder: ${params.eventTitle} is coming up!`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your event is coming up!</h2>
        <p>Hi ${params.buyerName},</p>
        <p>Just a friendly reminder that <strong>${params.eventTitle}</strong> is happening soon.</p>
        <p><strong>Venue:</strong> ${params.venueName}<br/>
        <strong>Date:</strong> ${new Date(params.startAt).toLocaleString()}<br/>
        <strong>Tickets:</strong> ${params.quantity}</p>
        <p>Don't forget to bring your QR code ticket for check-in. You can find it in your TicketHub account under "My Tickets".</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendEventApprovedEmail(params: {
  toEmail: string;
  organizerName: string;
  eventTitle: string;
  eventUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: `${params.eventTitle} has been approved and is now live!`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your event is live!</h2>
        <p>Hi ${params.organizerName},</p>
        <p>Good news - <strong>${params.eventTitle}</strong> has been reviewed and approved. It's now live and visible to buyers on TicketHub.</p>
        <p><a href="${params.eventUrl}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Your Event</a></p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

export async function sendEventRejectedEmail(params: {
  toEmail: string;
  organizerName: string;
  eventTitle: string;
  reason?: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: 'TicketHub <noreply@mytickethub.co.ke>',
    to: params.toEmail,
    subject: `${params.eventTitle} needs some changes before it can go live`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your event needs a few changes</h2>
        <p>Hi ${params.organizerName},</p>
        <p>We reviewed <strong>${params.eventTitle}</strong> and it needs some changes before it can be published. It has been moved back to draft in your dashboard.</p>
        ${params.reason ? `<p><strong>Feedback from our team:</strong><br/>${params.reason}</p>` : ''}
        <p>Please make the necessary updates and resubmit for review.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
      </div>
    `,
  });
}

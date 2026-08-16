// SMS notifications via Africa's Talking, following the same plain-fetch
// pattern as lib/paystack.ts (no SDK dependency needed).
//
// Requires two env vars: AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME.
// If either is missing, sendSms silently no-ops (logs a warning) rather than
// throwing — SMS is a nice-to-have alongside email, never something that
// should break ticket purchase or event creation if it's not configured yet.

const AT_BASE_URL = 'https://api.africastalking.com/version1/messaging';

/**
 * Normalizes a Kenyan phone number to the international format Africa's
 * Talking requires (+254XXXXXXXXX). Accepts common local formats:
 * 07XXXXXXXX, 01XXXXXXXX, 254XXXXXXXXX, or already-correct +254XXXXXXXXX.
 */
function normalizeKenyanPhone(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+254') && digits.length === 13) return digits;
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  return null; // Unrecognized format — caller should skip sending rather than guess.
}

export async function sendSms(to: string, message: string): Promise<void> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;

  if (!apiKey || !username) {
    console.warn('SMS not sent — AFRICASTALKING_API_KEY or AFRICASTALKING_USERNAME not configured.');
    return;
  }

  const normalizedPhone = normalizeKenyanPhone(to);
  if (!normalizedPhone) {
    console.warn('SMS not sent — could not normalize phone number:', to);
    return;
  }

  const body = new URLSearchParams({
    username,
    to: normalizedPhone,
    message,
  });

  const res = await fetch(AT_BASE_URL, {
    method: 'POST',
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => null);
  const recipientStatus = data?.SMSMessageData?.Recipients?.[0]?.status;

  if (!res.ok || (recipientStatus && recipientStatus !== 'Success')) {
    throw new Error(`Africa's Talking SMS failed: ${recipientStatus || res.statusText}`);
  }
}

export async function sendTicketConfirmationSms(params: {
  toPhone: string;
  eventTitle: string;
  quantity: number;
  ticketCodes: string[];
}) {
  const codesPreview = params.ticketCodes.slice(0, 3).join(', ');
  const more = params.ticketCodes.length > 3 ? ` +${params.ticketCodes.length - 3} more` : '';
  await sendSms(
    params.toPhone,
    `TicketHub: Payment confirmed for ${params.eventTitle}! ` +
      `${params.quantity} ticket(s). Code(s): ${codesPreview}${more}. ` +
      `Check your email for full details and QR codes.`
  );
}

export async function sendEventReminderSms(params: {
  toPhone: string;
  eventTitle: string;
  venueName: string;
  startAt: string | Date;
}) {
  const dateStr = new Date(params.startAt).toLocaleString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  await sendSms(
    params.toPhone,
    `TicketHub reminder: ${params.eventTitle} is coming up on ${dateStr} at ${params.venueName || 'the venue'}. Don't forget your ticket QR code!`
  );
}

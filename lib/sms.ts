/**
 * Africa's Talking SMS helper.
 * Env: AT_API_KEY, AT_USERNAME (sandbox | live username), optional AT_FROM (sender ID).
 */
function normalizeKenyaPhone(phone: string): string | null {
  let p = String(phone || '').replace(/[\s\-()]/g, '');
  if (!p) return null;
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0') && p.length === 10) p = '254' + p.slice(1);
  if (p.startsWith('7') && p.length === 9) p = '254' + p;
  if (p.startsWith('1') && p.length === 9) p = '254' + p;
  if (!/^254\d{9}$/.test(p)) return null;
  return '+' + p;
}

async function sendSmsRaw(toPhone: string, message: string): Promise<void> {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) {
    console.warn('SMS skipped: AT_API_KEY or AT_USERNAME not set');
    return;
  }

  const to = normalizeKenyaPhone(toPhone);
  if (!to) {
    console.warn('SMS skipped: invalid phone', toPhone);
    return;
  }

  const isSandbox = username === 'sandbox';
  const url = isSandbox
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';

  const body = new URLSearchParams();
  body.set('username', username);
  body.set('to', to);
  body.set('message', message.slice(0, 480));
  const from = process.env.AT_FROM?.trim();
  if (from) body.set('from', from);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Africa\'s Talking error', res.status, text);
    throw new Error('SMS failed: ' + res.status);
  }
  console.log('SMS sent to', to, text.slice(0, 200));
}

export async function sendTicketConfirmationSms(params: {
  toPhone: string;
  eventTitle: string;
  ticketUrl: string;
}) {
  const title = String(params.eventTitle || 'your event').slice(0, 40);
  const msg = `TicketHub: You're in for ${title}. View ticket: ${params.ticketUrl}`;
  await sendSmsRaw(params.toPhone, msg);
}

export async function sendEventReminderSms(params: {
  toPhone: string;
  eventTitle: string;
  venueName?: string;
  startAt?: string | Date;
}) {
  const title = String(params.eventTitle || 'your event').slice(0, 40);
  const venue = params.venueName ? ` at ${String(params.venueName).slice(0, 30)}` : '';
  let when = '';
  if (params.startAt) {
    try {
      when = ', ' + new Date(params.startAt).toLocaleString('en-KE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch { /* ignore */ }
  }
  const msg = `TicketHub reminder: ${title}${venue}${when}. See you there!`;
  await sendSmsRaw(params.toPhone, msg);
}

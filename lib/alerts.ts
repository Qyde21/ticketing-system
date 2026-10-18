import { sql } from '@/lib/db';
import { sendAdminAlertEmail } from '@/lib/email';

/**
 * Best-effort email to every admin user about something that needs a human
 * (e.g. a payment that doesn't match its order). Never throws: an alerting
 * failure must not break the request that raised it.
 */
export async function alertAdmins(subject: string, details: Record<string, unknown>): Promise<void> {
  try {
    const admins = await sql`SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL`;
    for (const a of admins as any[]) {
      try {
        await sendAdminAlertEmail({ toEmail: String(a.email), subject, details });
      } catch (err) {
        console.error('Failed to send admin alert to one recipient', err);
      }
    }
  } catch (err) {
    console.error('alertAdmins failed', err);
  }
}

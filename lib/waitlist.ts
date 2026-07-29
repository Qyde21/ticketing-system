import { sql } from '@/lib/db';
import { sendWaitlistSpotAvailableEmail } from '@/lib/email';

/**
 * Notifies up to `spotsFreed` people on the waitlist for a ticket type,
 * oldest signup first, and marks them as notified so they aren't emailed
 * again. Safe to call even if there's no waitlist - it just does nothing.
 */
export async function notifyWaitlistIfSpotsFreed(
  ticketTypeId: string,
  spotsFreed: number,
  baseUrl: string
): Promise<void> {
  if (spotsFreed <= 0) return;

  const entries = await sql`
    SELECT id, name, email FROM waitlist_entries
    WHERE ticket_type_id = ${ticketTypeId} AND notified_at IS NULL
    ORDER BY created_at ASC
    LIMIT ${spotsFreed}
  `;

  if (entries.length === 0) return;

  const [ticketType] = await sql`
    SELECT tt.id, tt.name AS ticket_type_name, e.title AS event_title, e.slug, e.id AS event_id
    FROM ticket_types tt
    JOIN events e ON e.id = tt.event_id
    WHERE tt.id = ${ticketTypeId}
  `;

  if (!ticketType) return;

  const checkoutUrl = `${baseUrl}/checkout/${ticketTypeId}`;

  for (const entry of entries) {
    try {
      await sendWaitlistSpotAvailableEmail({
        toEmail: entry.email,
        name: entry.name,
        eventTitle: ticketType.event_title,
        ticketTypeName: ticketType.ticket_type_name,
        checkoutUrl,
      });
      await sql`UPDATE waitlist_entries SET notified_at = now() WHERE id = ${entry.id}`;
    } catch (err) {
      console.error('Failed to notify waitlist entry', entry.id, err);
    }
  }
}

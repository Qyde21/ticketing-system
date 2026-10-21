import { sql } from '@/lib/db';
import { waitlistUnsubscribeUrl } from '@/lib/waitlistUnsubscribe';
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

  const [ticketType] = await sql`
    SELECT tt.id, tt.name AS ticket_type_name, e.title AS event_title, e.slug, e.id AS event_id,
           e.status AS event_status, e.start_at, e.end_at, u.status AS organizer_status
    FROM ticket_types tt
    JOIN events e ON e.id = tt.event_id
    JOIN users u ON u.id = e.organizer_id
    WHERE tt.id = ${ticketTypeId}
  `;

  if (!ticketType) return;

  // Only tell people a spot is open if the event can still be bought. Cancelling
  // an event refunds every order and so "frees" every seat - without this check
  // the whole waitlist was emailed "a spot just opened" for a cancelled event
  // (and for events that already took place, via the expiry cron).
  if (ticketType.event_status !== 'published') return;
  // Checkout refuses suspended organizers, so "a spot opened - buy now" would lead nowhere.
  if (ticketType.organizer_status === 'suspended') return;
  const eventEnd = ticketType.end_at || ticketType.start_at;
  if (eventEnd && new Date(eventEnd) < new Date()) return;

  // Claim the entries atomically BEFORE emailing. Two overlapping runs (e.g.
  // the expiry cron and a refund) used to read the same un-notified rows and
  // email the same people twice; SKIP LOCKED makes each run take different ones.
  const entries = await sql`
    UPDATE waitlist_entries SET notified_at = now()
    WHERE id IN (
      SELECT id FROM waitlist_entries
      WHERE ticket_type_id = ${ticketTypeId} AND notified_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${spotsFreed}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, name, email
  `;

  if (entries.length === 0) return;

  const checkoutUrl = `${baseUrl}/checkout/${ticketTypeId}`;

  for (const entry of entries) {
    try {
      await sendWaitlistSpotAvailableEmail({
        toEmail: entry.email,
        name: entry.name,
        eventTitle: ticketType.event_title,
        ticketTypeName: ticketType.ticket_type_name,
        checkoutUrl,
        unsubscribeUrl: waitlistUnsubscribeUrl(baseUrl, entry.id),
      });
    } catch (err) {
      console.error('Failed to notify waitlist entry', entry.id, err);
      // Not emailed after all: release the claim so a later run can retry.
      try {
        await sql`UPDATE waitlist_entries SET notified_at = NULL WHERE id = ${entry.id}`;
      } catch (releaseErr) {
        console.error('Could not release waitlist claim', entry.id, releaseErr);
      }
    }
  }
}

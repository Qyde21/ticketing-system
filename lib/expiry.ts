import { sql } from '@/lib/db';
import { notifyWaitlistIfSpotsFreed } from '@/lib/waitlist';

/** Pending orders older than this are expired and their seats released. */
export const EXPIRY_MINUTES = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Expires unpaid orders older than EXPIRY_MINUTES and gives their seats back.
 *
 * Why this is a function and not just the daily cron: the cron runs once a day
 * (Vercel Hobby allows nothing more often), so an order abandoned just after
 * it ran kept its seats for up to ~24 hours - events looked sold out while the
 * seats sat in unpaid carts. Checkout now calls this for the ticket types being
 * bought, so stale holds are released at the moment someone wants those seats.
 *
 * Each order is claimed and its seats released in ONE statement, so it cannot
 * be released twice (cron + checkout racing) and a crash cannot leave an order
 * expired with its seats still held.
 */
export async function expireStalePendingOrders(
  opts: { ticketTypeIds?: string[]; limit?: number; origin?: string } = {}
) {
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString();
  const limit = opts.limit ?? 200;
  const ids = (opts.ticketTypeIds ?? []).filter((id) => UUID_RE.test(id));
  const scoped = opts.ticketTypeIds !== undefined;
  if (scoped && ids.length === 0) return { scanned: 0, expired: 0, ticketsReleased: 0, failed: 0 };

  const pending = scoped
    ? await sql`
        SELECT o.id, o.ticket_type_id, o.quantity, o.total_amount_kes, o.discount_amount_kes, tt.flash_sale_price_kes
        FROM orders o
        JOIN ticket_types tt ON tt.id = o.ticket_type_id
        WHERE o.payment_status = 'pending' AND o.created_at < ${cutoff}
          AND o.ticket_type_id = ANY(${ids}::uuid[])
        ORDER BY o.created_at ASC
        LIMIT ${limit}`
    : await sql`
        SELECT o.id, o.ticket_type_id, o.quantity, o.total_amount_kes, o.discount_amount_kes, tt.flash_sale_price_kes
        FROM orders o
        JOIN ticket_types tt ON tt.id = o.ticket_type_id
        WHERE o.payment_status = 'pending' AND o.created_at < ${cutoff}
        ORDER BY o.created_at ASC
        LIMIT ${limit}`;

  let expired = 0;
  let released = 0;
  let failed = 0;
  const freedByType = new Map<string, number>();

  for (const order of pending) {
    try {
      const qty = Number(order.quantity) || 0;
      const lineGross = Number(order.total_amount_kes || 0) + Number(order.discount_amount_kes || 0);
      const unitPrice = qty > 0 ? lineGross / qty : NaN;
      const flashPrice = order.flash_sale_price_kes != null ? Number(order.flash_sale_price_kes) : null;
      const flashApplied = flashPrice != null && Number.isFinite(unitPrice) && Math.abs(unitPrice - flashPrice) < 0.02;

      const [row] = await sql`
        WITH claim AS (
          UPDATE orders SET payment_status = 'expired'
          WHERE id = ${order.id} AND payment_status = 'pending'
          RETURNING ticket_type_id
        ),
        rel AS (
          UPDATE ticket_types
          SET quantity_sold = GREATEST(0, quantity_sold - ${qty}),
              flash_sale_quantity_sold = GREATEST(0, flash_sale_quantity_sold - ${flashApplied ? qty : 0})
          WHERE id IN (SELECT ticket_type_id FROM claim) AND ${qty} > 0
          RETURNING id
        )
        SELECT (SELECT count(*) FROM claim)::int AS claimed
      `;
      if (!row || Number(row.claimed) === 0) continue; // someone else expired or paid it first

      expired++;
      if (qty > 0) {
        released += qty;
        const key = String(order.ticket_type_id);
        freedByType.set(key, (freedByType.get(key) || 0) + qty);
      }
    } catch (err) {
      console.error('Failed to expire order', order.id, err);
      failed++;
    }
  }

  // One notification per ticket type for everything freed (not one per order).
  const origin = opts.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://www.mytickethub.co.ke';
  for (const [ticketTypeId, qty] of freedByType) {
    try {
      await notifyWaitlistIfSpotsFreed(ticketTypeId, qty, origin);
    } catch (wErr) {
      console.error('Waitlist notify on expire failed', ticketTypeId, wErr);
    }
  }

  return { scanned: pending.length, expired, ticketsReleased: released, failed };
}

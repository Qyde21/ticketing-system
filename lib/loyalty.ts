import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';

// Tunable constants - change these to adjust the whole program's economics
// without touching any call sites.
export const KES_PER_POINT_EARNED = 100; // 1 point per KES 100 spent
export const KES_PER_POINT_REDEEMED = 1; // 1 point = KES 1 off at checkout
export const MIN_REDEMPTION_POINTS = 100; // smallest redemption allowed
export const REDEEMED_CODE_EXPIRY_DAYS = 30;

export const LOYALTY_TIERS = [
  { name: 'Gold', minPoints: 2000 },
  { name: 'Silver', minPoints: 500 },
  { name: 'Bronze', minPoints: 0 },
] as const;

export type LoyaltyTierName = (typeof LOYALTY_TIERS)[number]['name'];

export function tierForLifetimePoints(lifetimePoints: number): LoyaltyTierName {
  for (const tier of LOYALTY_TIERS) {
    if (lifetimePoints >= tier.minPoints) return tier.name;
  }
  return 'Bronze';
}

async function ensureLoyaltyTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT NOT NULL,
      order_id   UUID REFERENCES orders(id),
      points     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_email ON loyalty_transactions(LOWER(email))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order_id ON loyalty_transactions(order_id)`;
}

function isMissingTableError(msg: string) {
  const m = msg.toLowerCase();
  return m.includes('loyalty_transactions') && (m.includes('does not exist') || m.includes('undefined_table'));
}

async function withTableEnsured<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (isMissingTableError(msg)) {
      await ensureLoyaltyTable();
      return await fn();
    }
    throw err;
  }
}

export interface LoyaltySummary {
  balance: number;
  lifetimeEarned: number;
  tier: LoyaltyTierName;
}

export async function getLoyaltySummary(email: string): Promise<LoyaltySummary> {
  const normalized = email.trim().toLowerCase();

  return withTableEnsured(async () => {
    const [row] = await sql`
      SELECT
        COALESCE(SUM(points), 0) AS balance,
        COALESCE(SUM(points) FILTER (WHERE points > 0), 0) AS lifetime_earned
      FROM loyalty_transactions
      WHERE LOWER(email) = ${normalized}
    `;
    const balance = Number(row?.balance || 0);
    const lifetimeEarned = Number(row?.lifetime_earned || 0);
    return { balance, lifetimeEarned, tier: tierForLifetimePoints(lifetimeEarned) };
  });
}

/**
 * Awards points for a paid order. Idempotent - safe to call more than once
 * for the same order (e.g. if finalizePaidOrder is retried), since it
 * checks for an existing 'earned' transaction for that order_id first.
 * Never throws - a loyalty-points failure should never block ticket
 * issuance, so callers can fire-and-forget this.
 */
export async function awardPointsForOrder(orderId: string, email: string, amountKes: number): Promise<void> {
  try {
    await withTableEnsured(async () => {
      const [existing] = await sql`
        SELECT id FROM loyalty_transactions WHERE order_id = ${orderId} AND reason = 'earned'
      `;
      if (existing) return;

      const points = Math.floor(Number(amountKes || 0) / KES_PER_POINT_EARNED);
      if (points <= 0) return;

      await sql`
        INSERT INTO loyalty_transactions (email, order_id, points, reason)
        VALUES (${email.trim().toLowerCase()}, ${orderId}, ${points}, 'earned')
      `;
    });
  } catch (err) {
    console.error('awardPointsForOrder failed (non-fatal):', err);
  }
}

export interface RedeemResult {
  success: boolean;
  error?: string;
  code?: string;
  discountKes?: number;
}

/**
 * Redeems points into a real, single-use promo code scoped to one event -
 * reuses the platform's existing, already-tested promo-code discount logic
 * at checkout instead of the redemption flow having to touch checkout/
 * payment code directly.
 */
export async function redeemPointsForEvent(
  email: string,
  eventId: string,
  points: number
): Promise<RedeemResult> {
  const normalized = email.trim().toLowerCase();

  if (!Number.isFinite(points) || points < MIN_REDEMPTION_POINTS) {
    return { success: false, error: `Minimum redemption is ${MIN_REDEMPTION_POINTS} points` };
  }

  return withTableEnsured(async () => {
    const { balance } = await getLoyaltySummary(normalized);
    if (points > balance) {
      return { success: false, error: 'You do not have enough points for that' };
    }

    const [event] = await sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`;
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    const discountKes = points * KES_PER_POINT_REDEEMED;
    const code = 'LOYALTY-' + nanoid(8).toUpperCase();
    const expiresAt = new Date(Date.now() + REDEEMED_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO promo_codes (event_id, code, discount_type, discount_value, max_uses, expires_at, active)
      VALUES (${eventId}, ${code}, 'fixed', ${discountKes}, 1, ${expiresAt.toISOString()}, true)
    `;

    await sql`
      INSERT INTO loyalty_transactions (email, points, reason)
      VALUES (${normalized}, ${-points}, 'redeemed')
    `;

    return { success: true, code, discountKes };
  });
}
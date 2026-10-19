import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';

// Tunable constants - change these to adjust the whole program's economics
// without touching any call sites.
export const KES_PER_POINT_EARNED = 100; // 1 point per KES 100 spent
export const KES_PER_POINT_REDEEMED = 1; // 1 point = KES 1 off at checkout
export const MIN_REDEMPTION_POINTS = 100; // smallest redemption allowed
export const REDEEMED_CODE_EXPIRY_DAYS = 30;
export const MAX_REDEMPTION_POINTS = 1_000_000; // sanity cap, far above any real balance

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
        GREATEST(0, COALESCE(SUM(points) FILTER (WHERE points > 0 OR reason = 'refund_clawback'), 0)) AS lifetime_earned
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

/**
 * Takes back the points an order earned, when that order is refunded or its
 * event is cancelled. Otherwise refunded orders keep their points (and tier
 * progress) forever. Idempotent: a second call for the same order does
 * nothing. Never throws - callers are refund paths that must not fail because
 * of loyalty bookkeeping. A balance can go negative if the points were already
 * spent; the person simply can't redeem again until they earn more.
 */
export async function reverseLoyaltyPointsForOrder(orderId: string): Promise<void> {
  try {
    await withTableEnsured(async () => {
      await sql`
        INSERT INTO loyalty_transactions (email, order_id, points, reason)
        SELECT email, order_id, -points, 'refund_clawback'
        FROM loyalty_transactions
        WHERE order_id = ${orderId} AND reason = 'earned' AND points > 0
          AND NOT EXISTS (
            SELECT 1 FROM loyalty_transactions
            WHERE order_id = ${orderId} AND reason = 'refund_clawback'
          )
      `;
    });
  } catch (err) {
    console.error('reverseLoyaltyPointsForOrder failed (non-fatal):', err);
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
  if (!Number.isInteger(points) || points > MAX_REDEMPTION_POINTS) {
    return { success: false, error: 'That is not a valid number of points' };
  }

  return withTableEnsured(async () => {
    // Cheap early checks, no side effects. NOT the real guard - between this
    // read and the spend below, a parallel request could spend the same points.
    const { balance } = await getLoyaltySummary(normalized);
    if (points > balance) {
      return { success: false, error: 'You do not have enough points for that' };
    }

    const [event] = await sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`;
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // The real guard: SPEND FIRST, then verify. Each request writes its debit,
    // then re-reads the balance. Debits are committed and visible to anyone who
    // reads afterwards, so of any set of simultaneous redemptions the one that
    // reads last sees all the others' debits - the total spent can therefore
    // never exceed what was earned. A request that finds the balance negative
    // gives its debit back and fails (so two simultaneous requests that
    // together overspend may BOTH be turned away; the user just retries).
    // The old order - read balance, issue the promo code, then debit - let 20
    // parallel requests turn 1,000 points into 20 codes worth KES 20,000.
    const [debit] = await sql`
      INSERT INTO loyalty_transactions (email, points, reason)
      VALUES (${normalized}, ${-points}, 'redeemed')
      RETURNING id
    `;

    const giveBack = async () => {
      try {
        await sql`DELETE FROM loyalty_transactions WHERE id = ${debit.id}`;
      } catch (err) {
        console.error('Could not give back loyalty debit', debit.id, err);
      }
    };

    try {
      const after = await getLoyaltySummary(normalized);
      if (after.balance < 0) {
        await giveBack();
        return { success: false, error: 'You do not have enough points for that' };
      }

      const discountKes = points * KES_PER_POINT_REDEEMED;
      const code = 'LOYALTY-' + nanoid(8).toUpperCase();
      const expiresAt = new Date(Date.now() + REDEEMED_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await sql`
        INSERT INTO promo_codes (event_id, code, discount_type, discount_value, max_uses, expires_at, active)
        VALUES (${eventId}, ${code}, 'fixed', ${discountKes}, 1, ${expiresAt.toISOString()}, true)
      `;

      return { success: true, code, discountKes };
    } catch (err) {
      await giveBack(); // never charge points for a code that wasn't issued
      throw err;
    }
  });
}
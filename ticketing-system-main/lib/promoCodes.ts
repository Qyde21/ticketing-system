import { sql } from '@/lib/db';

export interface PromoValidationResult {
  valid: boolean;
  error?: string;
  promoCodeId?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  finalAmount?: number;
}

/**
 * Validates a promo code against an event and computes the discount for a
 * given subtotal. This is the single source of truth for discount math -
 * used both for the checkout "Apply" preview and the real order creation,
 * so a buyer can never send a fabricated discount amount to the server.
 */
export async function validatePromoCode(
  eventId: string,
  code: string,
  subtotalKes: number
): Promise<PromoValidationResult> {
  if (!code || !code.trim()) {
    return { valid: false, error: 'Please enter a promo code' };
  }

  const normalizedCode = code.trim().toUpperCase();

  const [promo] = await sql`
    SELECT id, code, discount_type, discount_value, max_uses, uses_count, expires_at, active
    FROM promo_codes
    WHERE event_id = ${eventId} AND UPPER(code) = ${normalizedCode}
  `;

  if (!promo) {
    return { valid: false, error: 'Invalid promo code' };
  }
  if (!promo.active) {
    return { valid: false, error: 'This promo code is no longer active' };
  }
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, error: 'This promo code has expired' };
  }
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }

  let discountAmount: number;
  if (promo.discount_type === 'percent') {
    discountAmount = Math.round(subtotalKes * (Number(promo.discount_value) / 100));
  } else {
    discountAmount = Number(promo.discount_value);
  }
  discountAmount = Math.max(0, Math.min(discountAmount, subtotalKes));

  const finalAmount = Math.max(0, subtotalKes - discountAmount);

  return {
    valid: true,
    promoCodeId: promo.id,
    discountType: promo.discount_type,
    discountValue: Number(promo.discount_value),
    discountAmount,
    finalAmount,
  };
}

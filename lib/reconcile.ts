import { sql } from '@/lib/db';
import { verifyTransaction } from '@/lib/paystack';
import { settleSuccessfulPayment } from '@/lib/paymentSettlement';

// Look at orders from this window. Younger than MIN_AGE_MINUTES may simply be
// mid-payment (the webhook is about to arrive); older than MAX_AGE_HOURS has
// had a day of webhook retries and browser redirects already. A daily run with
// a 26h window checks each order once (occasionally twice) rather than
// re-asking Paystack about the same abandoned cart for days.
const MIN_AGE_MINUTES = 15;
const MAX_AGE_HOURS = 26;
const CONCURRENCY = 5;

/**
 * Safety net for the one thing that must never happen: a buyer's money taken
 * and no ticket. Normally Paystack's webhook (or the browser redirect) turns a
 * payment into tickets. If both fail - webhook endpoint down, buyer closes the
 * page - the order just sits 'pending', then 'expired', and nobody is told.
 * This asks Paystack about recent unpaid orders and finishes any that were
 * actually paid (issuing tickets, or refunding if the seats are gone, via the
 * normal settlement path). Safe to run any time and as often as you like: the
 * ticket-issuing step is atomic and idempotent.
 */
export async function reconcilePayments(
  baseUrl: string,
  opts: { limit?: number; budgetMs?: number } = {}
) {
  const limit = opts.limit ?? 150;
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);

  const refs = await sql`
    SELECT o.paystack_reference AS reference
    FROM orders o
    WHERE o.paystack_reference IS NOT NULL
      AND o.payment_status IN ('pending', 'expired')
      AND o.total_amount_kes > 0
      AND o.created_at < now() - (${MIN_AGE_MINUTES} * interval '1 minute')
      AND o.created_at > now() - (${MAX_AGE_HOURS} * interval '1 hour')
    GROUP BY o.paystack_reference
    ORDER BY MIN(o.created_at) ASC
    LIMIT ${limit}
  `;
  const references = refs.map((r: any) => String(r.reference));

  const result = {
    checked: 0,
    paidFound: 0,
    recoveredOrders: 0,
    mismatches: 0,
    errors: 0,
    skippedForTime: 0,
    errorSamples: [] as string[],
  };

  for (let i = 0; i < references.length; i += CONCURRENCY) {
    if (Date.now() > deadline) {
      result.skippedForTime = references.length - i;
      break;
    }
    await Promise.all(
      references.slice(i, i + CONCURRENCY).map(async (reference) => {
        result.checked++;
        try {
          const v = await verifyTransaction(reference);
          if (v.kind === 'error') {
            result.errors++;
            if (result.errorSamples.length < 3) result.errorSamples.push(`${reference}: ${v.message}`);
            return;
          }
          if (v.kind !== 'success') return; // not paid: the normal expiry handles it
          result.paidFound++;
          const settled = await settleSuccessfulPayment({
            reference,
            paidAmountKes: v.amountKes,
            currency: v.currency,
            baseUrl,
          });
          if (settled.outcome === 'mismatch') result.mismatches++;
          if (settled.outcome === 'finalized') result.recoveredOrders += settled.recovered;
        } catch (err: any) {
          result.errors++;
          if (result.errorSamples.length < 3) result.errorSamples.push(`${reference}: ${String(err?.message || err)}`);
        }
      })
    );
  }

  return result;
}

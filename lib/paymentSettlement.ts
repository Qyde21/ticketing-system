import { sql } from '@/lib/db';
import { finalizePaidOrder } from '@/lib/tickets';
import { alertAdmins } from '@/lib/alerts';

export type SettleOutcome =
  | { outcome: 'no_orders' }
  | { outcome: 'mismatch' }
  | { outcome: 'finalized'; orderIds: string[]; recovered: number };

/**
 * One place that turns "Paystack says this reference was paid" into tickets.
 * The webhook, the browser verify redirect and the reconciliation job all call
 * this, so they can never disagree. (The verify redirect used to only log an
 * amount mismatch - no alert and no currency check - while the webhook did both.)
 *
 * Never issues tickets for a payment that doesn't match what we asked for; an
 * admin is emailed instead, since the buyer's money has been taken.
 * `recovered` counts orders that were not yet paid before this call.
 */
export async function settleSuccessfulPayment(params: {
  reference: string;
  paidAmountKes: number;
  currency?: string;
  baseUrl: string;
}): Promise<SettleOutcome> {
  const { reference, paidAmountKes, currency, baseUrl } = params;

  const orders = await sql`
    SELECT id, payment_status, total_amount_kes
    FROM orders WHERE paystack_reference = ${reference}
  `;
  if (orders.length === 0) return { outcome: 'no_orders' };

  const orderIds = orders.map((o: any) => String(o.id));

  if (currency && currency !== 'KES') {
    console.error('Currency mismatch for reference', reference, { currency });
    await alertAdmins('Payment in unexpected currency', { reference, currency, paid: paidAmountKes, orderIds });
    return { outcome: 'mismatch' };
  }

  const expectedTotal = orders.reduce((s: number, o: any) => s + Number(o.total_amount_kes), 0);
  if (Math.abs(paidAmountKes - expectedTotal) > 0.01) {
    console.error('Amount mismatch for reference', reference, { paidAmountKes, expectedTotal });
    await alertAdmins('Payment amount does not match order', {
      reference,
      paidKes: paidAmountKes,
      expectedKes: expectedTotal,
      orderIds,
    });
    return { outcome: 'mismatch' };
  }

  const recovered = orders.filter((o: any) => o.payment_status !== 'paid' && o.payment_status !== 'refunded').length;
  for (const id of orderIds) {
    await finalizePaidOrder(id, baseUrl);
  }
  return { outcome: 'finalized', orderIds, recovered };
}

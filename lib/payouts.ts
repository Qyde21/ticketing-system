import { sql } from '@/lib/db';
import { createTransferRecipient, initiateTransfer, fetchTransfer } from '@/lib/paystack';
import { nanoid } from 'nanoid';

export const PLATFORM_FEE_RATE = 0.1;
export const MIN_PAYOUT_KES = 50;
export const PAYOUT_DELAY_HOURS = 48;

export type EventEarnings = {
  eventId: string;
  organizerId: string;
  title: string;
  endAt: string | null;
  status: string;
  gross: number;
  refunded: number;
  fee: number;
  net: number;
};

export function computeNet(gross: number, refunded: number) {
  const g = Math.max(0, Number(gross) || 0);
  const r = Math.max(0, Number(refunded) || 0);
  const eligible = Math.max(0, g - r);
  const fee = Math.round(eligible * PLATFORM_FEE_RATE * 100) / 100;
  const net = Math.round((eligible - fee) * 100) / 100;
  return { gross: g, refunded: r, fee, net };
}

export async function getEventEarnings(eventId: string): Promise<EventEarnings | null> {
  const [row] = await sql`
    SELECT
      e.id AS event_id,
      e.organizer_id,
      e.title,
      e.end_at,
      e.start_at,
      e.status,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE e.id = ${eventId}
    GROUP BY e.id
  `;
  if (!row) return null;
  const { gross, refunded, fee, net } = computeNet(Number(row.gross), Number(row.refunded));
  return {
    eventId: row.event_id as string,
    organizerId: row.organizer_id as string,
    title: row.title as string,
    endAt: (row.end_at || row.start_at) ? String(row.end_at || row.start_at) : null,
    status: row.status as string,
    gross,
    refunded,
    fee,
    net,
  };
}

export async function ensureRecipient(organizerId: string): Promise<string> {
  const [profile] = await sql`
    SELECT
      op.payout_method, op.payout_name, op.payout_phone,
      op.bank_code, op.bank_account_number, op.paystack_recipient_code,
      u.full_name, u.email
    FROM organizer_profiles op
    JOIN users u ON u.id = op.user_id
    WHERE op.user_id = ${organizerId}
  `;
  if (!profile) throw new Error('Organizer profile not found. Complete payout details first.');
  if (profile.paystack_recipient_code) return profile.paystack_recipient_code as string;

  const method = profile.payout_method as string | null;
  const name = (profile.payout_name || profile.full_name || 'Organizer') as string;

  if (method === 'mpesa') {
    const phone = String(profile.payout_phone || '').replace(/\s+/g, '');
    if (!phone) throw new Error('M-Pesa phone number is required');
    let account = phone.replace(/^\+/, '');
    if (account.startsWith('0')) account = '254' + account.slice(1);
    if (!account.startsWith('254')) account = '254' + account;

    const recipient = await createTransferRecipient({
      type: 'mobile_money',
      name,
      accountNumber: account,
      bankCode: 'MPESA',
      currency: 'KES',
    });
    await sql`
      UPDATE organizer_profiles
      SET paystack_recipient_code = ${recipient.recipient_code},
          payout_updated_at = now()
      WHERE user_id = ${organizerId}
    `;
    return recipient.recipient_code;
  }

  if (method === 'bank') {
    const bankCode = String(profile.bank_code || '');
    const accountNumber = String(profile.bank_account_number || '');
    if (!bankCode || !accountNumber) throw new Error('Bank code and account number are required');
    const recipient = await createTransferRecipient({
      type: 'basa',
      name,
      accountNumber,
      bankCode,
      currency: 'KES',
    });
    await sql`
      UPDATE organizer_profiles
      SET paystack_recipient_code = ${recipient.recipient_code},
          payout_updated_at = now()
      WHERE user_id = ${organizerId}
    `;
    return recipient.recipient_code;
  }

  throw new Error('Set a payout method (M-Pesa or bank) before requesting payout');
}

export async function queuePayoutForEvent(eventId: string, opts?: { force?: boolean }) {
  const earnings = await getEventEarnings(eventId);
  if (!earnings) throw new Error('Event not found');
  if (earnings.net < MIN_PAYOUT_KES) {
    throw new Error(`Net payout KES ${earnings.net} is below minimum KES ${MIN_PAYOUT_KES}`);
  }

  const [existing] = await sql`
    SELECT id, status, net_kes FROM organizer_payouts WHERE event_id = ${eventId}
  `;
  if (existing) {
    if (existing.status === 'paid') throw new Error('This event was already paid out');
    if (existing.status === 'processing' && !opts?.force) {
      throw new Error('Payout is already processing');
    }
    if (existing.status === 'pending' || existing.status === 'failed') {
      return { payoutId: existing.id as string, created: false };
    }
  }

  const [row] = await sql`
    INSERT INTO organizer_payouts (
      organizer_id, event_id, gross_kes, refunded_kes, platform_fee_kes, net_kes, status
    ) VALUES (
      ${earnings.organizerId},
      ${eventId},
      ${earnings.gross},
      ${earnings.refunded},
      ${earnings.fee},
      ${earnings.net},
      'pending'
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
  `;
  if (row) return { payoutId: row.id as string, created: true };

  const [again] = await sql`SELECT id FROM organizer_payouts WHERE event_id = ${eventId}`;
  return { payoutId: again.id as string, created: false };
}

export async function processPayout(payoutId: string) {
  const [payout] = await sql`
    SELECT p.*, e.title AS event_title
    FROM organizer_payouts p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = ${payoutId}
  `;
  if (!payout) throw new Error('Payout not found');
  if (payout.status === 'paid') return { status: 'paid' as const, payout };

  if (payout.status === 'processing' && payout.paystack_transfer_code) {
    try {
      const t = await fetchTransfer(payout.paystack_transfer_code as string);
      if (t.status === 'success') {
        await sql`
          UPDATE organizer_payouts
          SET status = 'paid', paid_at = now(), processed_at = now()
          WHERE id = ${payoutId}
        `;
        return { status: 'paid' as const, payout };
      }
    } catch {
      /* retry transfer */
    }
    // Already processing with no confirmed success yet â€” do not re-enter
    // the pending/failed branch below, which would call Paystack again.
    return { status: 'processing' as const, payout };
  }

  const net = Number(payout.net_kes);
  if (net < MIN_PAYOUT_KES) throw new Error('Amount below minimum');

  const recipientCode = await ensureRecipient(payout.organizer_id as string);
  const reference = payout.paystack_reference || `payout_${nanoid(12)}`;

  // Atomically claim the payout before calling Paystack: the WHERE guard
  // means only ONE concurrent call can actually flip pending/failed ->
  // processing. If two requests race (double-click, or a cron overlapping
  // a manual request), the loser gets zero rows back here and bails out
  // instead of also initiating a second real money transfer.
  const [claimed] = await sql`
    UPDATE organizer_payouts
    SET status = 'processing',
        paystack_reference = ${reference},
        processed_at = now(),
        failure_reason = NULL
    WHERE id = ${payoutId} AND status IN ('pending', 'failed')
    RETURNING id
  `;
  if (!claimed) {
    // Someone else already claimed it between our read above and now.
    return { status: 'processing' as const, payout };
  }

  try {
    const transfer = await initiateTransfer({
      amountKes: net,
      recipientCode,
      reference,
      reason: `TicketHub payout: ${payout.event_title}`,
    });

    if (transfer.status === 'success') {
      await sql`
        UPDATE organizer_payouts
        SET status = 'paid',
            paystack_transfer_code = ${transfer.transfer_code},
            paid_at = now()
        WHERE id = ${payoutId}
      `;
      return { status: 'paid' as const, transfer };
    }

    await sql`
      UPDATE organizer_payouts
      SET status = 'processing',
          paystack_transfer_code = ${transfer.transfer_code}
      WHERE id = ${payoutId}
    `;
    return { status: 'processing' as const, transfer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    await sql`
      UPDATE organizer_payouts
      SET status = 'failed', failure_reason = ${message}
      WHERE id = ${payoutId}
    `;
    throw err;
  }
}

export async function listAutoPayoutCandidates(limit = 50) {
  const cutoff = new Date(Date.now() - PAYOUT_DELAY_HOURS * 60 * 60 * 1000).toISOString();
  return sql`
    SELECT
      e.id AS event_id,
      e.organizer_id,
      e.title,
      COALESCE(e.end_at, e.start_at) AS ended_at,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    LEFT JOIN organizer_payouts op ON op.event_id = e.id
    JOIN organizer_profiles pr ON pr.user_id = e.organizer_id
    WHERE e.status IN ('published', 'completed', 'cancelled')
      AND COALESCE(e.end_at, e.start_at) < ${cutoff}
      AND pr.paystack_recipient_code IS NOT NULL
      AND (op.id IS NULL OR op.status IN ('pending', 'failed'))
    GROUP BY e.id, pr.paystack_recipient_code, op.id, op.status
    HAVING COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0)
         - COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) > 0
    ORDER BY COALESCE(e.end_at, e.start_at) ASC
    LIMIT ${limit}
  `;
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createTransferRecipient } from '@/lib/paystack';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const [row] = await sql`
    SELECT payout_method, payout_name, payout_phone, bank_code, bank_account_number,
           paystack_recipient_code IS NOT NULL AS recipient_ready, payout_updated_at
    FROM organizer_profiles WHERE user_id = ${session.userId}
  `;
  return NextResponse.json(row || {});
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const method = body.method === 'bank' ? 'bank' : 'mpesa';
    const payoutName = String(body.payoutName || '').trim();
    if (!payoutName) {
      return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    let payoutPhone: string | null = null;
    let bankCode: string | null = null;
    let bankAccountNumber: string | null = null;
    let recipientCode: string | null = null;

    if (method === 'mpesa') {
      payoutPhone = String(body.payoutPhone || '').replace(/\s+/g, '');
      if (!payoutPhone || payoutPhone.length < 9) {
        return NextResponse.json({ error: 'Valid M-Pesa number required' }, { status: 400 });
      }
      let account = payoutPhone.replace(/^\+/, '');
      if (account.startsWith('0')) account = '254' + account.slice(1);
      if (!account.startsWith('254')) account = '254' + account;

      const recipient = await createTransferRecipient({
        type: 'mobile_money',
        name: payoutName,
        accountNumber: account,
        bankCode: 'MPESA',
        currency: 'KES',
      });
      recipientCode = recipient.recipient_code;
      payoutPhone = account;
    } else {
      bankCode = String(body.bankCode || '').trim();
      bankAccountNumber = String(body.bankAccountNumber || '').trim();
      if (!bankCode || !bankAccountNumber) {
        return NextResponse.json({ error: 'Bank code and account number required' }, { status: 400 });
      }
      const recipient = await createTransferRecipient({
        type: 'basa',
        name: payoutName,
        accountNumber: bankAccountNumber,
        bankCode,
        currency: 'KES',
      });
      recipientCode = recipient.recipient_code;
    }

    await sql`
      INSERT INTO organizer_profiles (
        user_id, payout_method, payout_name, payout_phone,
        bank_code, bank_account_number, paystack_recipient_code, payout_updated_at
      ) VALUES (
        ${session.userId}, ${method}, ${payoutName}, ${payoutPhone},
        ${bankCode}, ${bankAccountNumber}, ${recipientCode}, now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        payout_method = EXCLUDED.payout_method,
        payout_name = EXCLUDED.payout_name,
        payout_phone = EXCLUDED.payout_phone,
        bank_code = EXCLUDED.bank_code,
        bank_account_number = EXCLUDED.bank_account_number,
        paystack_recipient_code = EXCLUDED.paystack_recipient_code,
        payout_updated_at = now()
    `;

    return NextResponse.json({ ok: true, recipientReady: true });
  } catch (err: unknown) {
    console.error('payout-account save:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save payout account' },
      { status: 500 }
    );
  }
}

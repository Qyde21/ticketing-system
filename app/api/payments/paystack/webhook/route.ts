import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { finalizePaidOrder } from '@/lib/tickets';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'charge.success') {
    const reference = event.data.reference;

    const [order] = await sql`
      SELECT id, payment_status, total_amount_kes
      FROM orders WHERE paystack_reference = ${reference}
    `;

    if (order) {
      const paidAmountKes = event.data.amount / 100;
      if (Math.abs(paidAmountKes - Number(order.total_amount_kes)) > 0.01) {
        console.error('Amount mismatch for order', order.id);
        return NextResponse.json({ received: true });
      }

      // Idempotent: creates tickets if missing, even when status was already 'paid'
      // (e.g. legacy verify path that only flipped the flag).
      await finalizePaidOrder(order.id, req.nextUrl.origin);
    }
  }

  return NextResponse.json({ received: true });
}

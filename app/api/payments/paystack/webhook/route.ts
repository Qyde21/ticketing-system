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

    const orders = await sql`
      SELECT id, payment_status, total_amount_kes
      FROM orders WHERE paystack_reference = ${reference}
    `;

    if (orders.length > 0) {
      const paidAmountKes = event.data.amount / 100;
      const expectedTotal = orders.reduce((s: number, o: any) => s + Number(o.total_amount_kes), 0);
      if (Math.abs(paidAmountKes - expectedTotal) > 0.01) {
        console.error('Amount mismatch for reference', reference, { paidAmountKes, expectedTotal });
        return NextResponse.json({ received: true });
      }

      for (const order of orders) {
        await finalizePaidOrder(order.id, process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin);
      }
    }
  }

  return NextResponse.json({ received: true });
}
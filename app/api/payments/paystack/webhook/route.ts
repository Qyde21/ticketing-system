import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { finalizePaidOrder } from '@/lib/tickets';
import { verifyPaystackSignature } from '@/lib/paystackWebhook';
import { alertAdmins } from '@/lib/alerts';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('PAYSTACK_SECRET_KEY is not set - cannot verify webhooks');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!verifyPaystackSignature(rawBody, signature, secret)) {
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
      const currency = event.data.currency;

      // Never issue tickets for a payment that doesn't match what we asked
      // for. Return 200 (a retry would not change the outcome) but tell an
      // admin, since the buyer's money has been taken.
      if (currency && currency !== 'KES') {
        console.error('Currency mismatch for reference', reference, { currency });
        await alertAdmins('Payment in unexpected currency', {
          reference,
          currency,
          paid: event.data.amount / 100,
          orderIds: orders.map((o: any) => o.id),
        });
        return NextResponse.json({ received: true });
      }

      if (Math.abs(paidAmountKes - expectedTotal) > 0.01) {
        console.error('Amount mismatch for reference', reference, { paidAmountKes, expectedTotal });
        await alertAdmins('Payment amount does not match order', {
          reference,
          paidKes: paidAmountKes,
          expectedKes: expectedTotal,
          orderIds: orders.map((o: any) => o.id),
        });
        return NextResponse.json({ received: true });
      }

      for (const order of orders) {
        await finalizePaidOrder(order.id, process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin);
      }
    }
  }

  return NextResponse.json({ received: true });
}

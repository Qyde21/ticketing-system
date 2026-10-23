import { NextRequest, NextResponse } from 'next/server';
import { settleSuccessfulPayment } from '@/lib/paymentSettlement';
import { verifyPaystackSignature } from '@/lib/paystackWebhook';

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
    await settleSuccessfulPayment({
      reference: event.data.reference,
      paidAmountKes: event.data.amount / 100,
      currency: event.data.currency,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin,
    });
  }

  return NextResponse.json({ received: true });
}

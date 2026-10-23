import { signOrderClaim } from '@/lib/orderClaim';
import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/paystack';
import { settleSuccessfulPayment } from '@/lib/paymentSettlement';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.redirect(new URL('/?error=missing_reference', req.url));
  }

  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error('PAYSTACK_SECRET_KEY is not configured - cannot verify payment');
      return NextResponse.redirect(new URL('/?error=payment_config', req.url));
    }

    const verified = await verifyTransaction(reference);

    if (verified.kind === 'error') {
      console.error('Verify payment error:', verified.message);
      return NextResponse.redirect(new URL('/?error=payment_verify_failed', req.url));
    }

    if (verified.kind === 'success') {
      // Same amount/currency checks, alerts and ticket issuing as the webhook.
      const settled = await settleSuccessfulPayment({
        reference,
        paidAmountKes: verified.amountKes,
        currency: verified.currency,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin,
      });
      if (settled.outcome === 'no_orders') {
        console.error('No orders for successful reference', reference);
      }

      const claimToken = await signOrderClaim(reference);
      const successUrl =
        '/success?reference=' +
        encodeURIComponent(reference) +
        '&claim=' +
        encodeURIComponent(claimToken);
      return NextResponse.redirect(new URL(successUrl, req.url));
    }

    return NextResponse.redirect(
      new URL('/?error=payment_failed&reference=' + encodeURIComponent(reference), req.url)
    );
  } catch (err) {
    console.error('Verify payment error:', err);
    return NextResponse.redirect(new URL('/?error=payment_verify_failed', req.url));
  }
}

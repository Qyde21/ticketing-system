import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { finalizePaidOrder } from '@/lib/tickets';

/**
 * Paystack redirects the buyer here after payment.
 * Must both confirm payment with Paystack AND issue tickets (via finalizePaidOrder).
 * Safe to run alongside the webhook — finalizePaidOrder is idempotent.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.redirect(new URL('/?error=missing_reference', req.url));
  }

  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSecret) {
      console.error('PAYSTACK_SECRET_KEY is not configured - cannot verify payment');
      return NextResponse.redirect(new URL('/?error=verification_unavailable', req.url));
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyRes.json();

    if (verifyData.status && verifyData.data?.status === 'success') {
      const [order] = await sql`
        SELECT id, payment_status, total_amount_kes
        FROM orders WHERE paystack_reference = ${reference}
      `;

      if (order) {
        const paidAmountKes = Number(verifyData.data.amount) / 100;
        if (Math.abs(paidAmountKes - Number(order.total_amount_kes)) > 0.01) {
          console.error('Amount mismatch on verify for order', order.id, {
            paid: paidAmountKes,
            expected: order.total_amount_kes,
          });
          return NextResponse.redirect(new URL(`/?error=amount_mismatch&reference=${reference}`, req.url));
        }

        // Issues tickets + marks paid. No-op if webhook already finalized.
        await finalizePaidOrder(order.id, req.nextUrl.origin);
      }
    }

    return NextResponse.redirect(new URL(`/success?reference=${reference}`, req.url));
  } catch (err) {
    console.error('Verification error:', err);
    return NextResponse.redirect(new URL('/?error=verification_failed', req.url));
  }
}

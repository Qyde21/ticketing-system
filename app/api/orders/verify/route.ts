import { signOrderClaim } from '@/lib/orderClaim';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { finalizePaidOrder } from '@/lib/tickets';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.redirect(new URL('/?error=missing_reference', req.url));
  }

  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      console.error('PAYSTACK_SECRET_KEY is not configured - cannot verify payment');
      return NextResponse.redirect(new URL('/?error=payment_config', req.url));
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const verifyData = await verifyRes.json();

    if (verifyData.status && verifyData.data?.status === 'success') {
      const orders = await sql`
        SELECT id, payment_status, total_amount_kes
        FROM orders WHERE paystack_reference = ${reference}
      `;

      if (orders.length === 0) {
        console.error('No orders for successful reference', reference);
      } else {
        const paidAmountKes = verifyData.data.amount / 100;
        const expectedTotal = orders.reduce((s: number, o: any) => s + Number(o.total_amount_kes), 0);
        if (Math.abs(paidAmountKes - expectedTotal) > 0.01) {
          console.error('Amount mismatch for reference', reference, 'via verify redirect');
        } else {
          for (const order of orders) {
            await finalizePaidOrder(order.id, process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin);
          }
        }
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

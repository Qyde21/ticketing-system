import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { finalizePaidOrder } from '@/lib/tickets';

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
        'Content-Type': 'application/json'
      }
    });

    const verifyData = await verifyRes.json();

    if (verifyData.status && verifyData.data?.status === 'success') {
      const [order] = await sql`
        SELECT id, payment_status, total_amount_kes
        FROM orders WHERE paystack_reference = ${reference}
      `;

      if (order && order.payment_status !== 'paid') {
        // Cross-check the amount Paystack actually confirms against what we
        // charged for, same as the webhook does — defense in depth in case
        // a reference is ever reused or tampered with.
        const paidAmountKes = verifyData.data.amount / 100;
        if (Math.abs(paidAmountKes - Number(order.total_amount_kes)) > 0.01) {
          console.error('Amount mismatch for order', order.id, 'via verify redirect');
          return NextResponse.redirect(new URL('/?error=verification_failed', req.url));
        }

        // Use the same shared function the webhook uses — this generates the
        // actual ticket codes, increments sold counts, and emails the buyer.
        // Calling this (instead of a raw UPDATE) also means if the webhook
        // fires later for the same order, its `payment_status !== 'paid'`
        // guard will correctly skip re-processing rather than silently
        // never issuing tickets at all.
        await finalizePaidOrder(order.id, req.nextUrl.origin);
      }
    }

    // Redirect user to a success confirmation view or home with success flag
    return NextResponse.redirect(new URL(`/success?reference=${reference}`, req.url));
  } catch (err) {
    console.error("Verification error:", err);
    return NextResponse.redirect(new URL('/?error=verification_failed', req.url));
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.redirect(new URL('/?error=missing_reference', req.url));
  }

  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    
    if (paystackSecret) {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      });

      const verifyData = await verifyRes.json();
      
      if (verifyData.status && verifyData.data?.status === 'success') {
        await sql`
          UPDATE orders 
          SET payment_status = 'paid' 
          WHERE paystack_reference = ${reference}
        `;
      }
    } else {
      // Fallback if secret key isn't set during testing
      await sql`
        UPDATE orders 
        SET payment_status = 'paid' 
        WHERE paystack_reference = ${reference}
      `;
    }

    // Redirect user to a success confirmation view or home with success flag
    return NextResponse.redirect(new URL(`/success?reference=${reference}`, req.url));
  } catch (err) {
    console.error("Verification error:", err);
    return NextResponse.redirect(new URL('/?error=verification_failed', req.url));
  }
}
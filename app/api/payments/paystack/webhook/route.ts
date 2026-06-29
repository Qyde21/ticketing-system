import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';

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
      SELECT id, payment_status, ticket_type_id, quantity, buyer_name, total_amount_kes
      FROM orders WHERE paystack_reference = ${reference}
    `;

    if (order && order.payment_status !== 'paid') {
      const paidAmountKes = event.data.amount / 100;
      if (Math.abs(paidAmountKes - Number(order.total_amount_kes)) > 0.01) {
        console.error('Amount mismatch for order', order.id);
        return NextResponse.json({ received: true });
      }

      await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${order.id}`;

      for (let i = 0; i < order.quantity; i++) {
        const ticketCode = nanoid(10).toUpperCase();
        await sql`
          INSERT INTO tickets (order_id, ticket_type_id, ticket_code, holder_name, status)
          VALUES (${order.id}, ${order.ticket_type_id}, ${ticketCode}, ${order.buyer_name}, 'valid')
        `;
      }

      await sql`
        UPDATE ticket_types SET quantity_sold = quantity_sold + ${order.quantity}
        WHERE id = ${order.ticket_type_id}
      `;
    }
  }

  return NextResponse.json({ received: true });
}
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pending orders older than this are expired and inventory is released. */
const EXPIRY_MINUTES = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString();

  const pending = await sql`
    SELECT
      o.id,
      o.ticket_type_id,
      o.quantity,
      o.total_amount_kes,
      o.discount_amount_kes,
      o.created_at,
      o.paystack_reference,
      tt.flash_sale_price_kes
    FROM orders o
    JOIN ticket_types tt ON tt.id = o.ticket_type_id
    WHERE o.payment_status = 'pending'
      AND o.created_at < ${cutoff}
    ORDER BY o.created_at ASC
    LIMIT 200
  `;

  let expired = 0;
  let released = 0;
  let failed = 0;

  for (const order of pending) {
    try {
      const qty = Number(order.quantity) || 0;
      if (qty < 1) {
        await sql`
          UPDATE orders
          SET payment_status = 'expired'
          WHERE id = ${order.id} AND payment_status = 'pending'
        `;
        expired++;
        continue;
      }

      const lineGross =
        Number(order.total_amount_kes || 0) + Number(order.discount_amount_kes || 0);
      const unitPrice = lineGross / qty;
      const flashPrice = order.flash_sale_price_kes != null ? Number(order.flash_sale_price_kes) : null;
      const flashApplied =
        flashPrice != null && Number.isFinite(unitPrice) && Math.abs(unitPrice - flashPrice) < 0.02;

      const updated = await sql`
        UPDATE orders
        SET payment_status = 'expired'
        WHERE id = ${order.id} AND payment_status = 'pending'
        RETURNING id
      `;
      if (!updated[0]) continue;

      await sql`
        UPDATE ticket_types
        SET
          quantity_sold = GREATEST(0, quantity_sold - ${qty}),
          flash_sale_quantity_sold = GREATEST(
            0,
            flash_sale_quantity_sold - ${flashApplied ? qty : 0}
          )
        WHERE id = ${order.ticket_type_id}
      `;

      expired++;
      released += qty;
    } catch (err) {
      console.error('Failed to expire order', order.id, err);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    expiryMinutes: EXPIRY_MINUTES,
    scanned: pending.length,
    expired,
    ticketsReleased: released,
    failed,
  });
}
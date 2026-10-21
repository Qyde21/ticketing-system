import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { NextRequest, NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes an event that has no financial history. Events with paid or refunded
 * orders, or a payout record, must be kept: deleting them would destroy the
 * payment trail (payout rows cascade from events, and refunded orders carry
 * payment_events and loyalty rows). Cancel such events instead.
 *
 * Everything is ONE SQL statement, so it either deletes the event and its
 * leftovers (unpaid orders, their tickets/payment events, messages, staff;
 * ticket types, promo codes, waitlist etc. cascade) or deletes nothing. The
 * old route deleted piece by piece, and when a later step failed (it did for
 * any event with a refunded order, because loyalty_transactions references
 * orders) it had already deleted tickets and payment records while leaving the
 * event in place.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const [event] = await sql`SELECT id, title, status FROM events WHERE id = ${id}`;
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const [history] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM orders WHERE event_id = ${id} AND payment_status = 'paid') AS paid_count,
        (SELECT COUNT(*)::int FROM orders WHERE event_id = ${id} AND payment_status = 'refunded') AS refunded_count,
        (SELECT COUNT(*)::int FROM organizer_payouts WHERE event_id = ${id}) AS payout_count
    `;

    if (Number(history.paid_count) > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: this event has ${history.paid_count} paid order(s). Cancel the event and handle refunds first. Delete is only for drafts, copies, or events with no sales.`,
          paidCount: history.paid_count,
        },
        { status: 400 }
      );
    }
    if (Number(history.refunded_count) > 0 || Number(history.payout_count) > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete: this event has refunded orders or a payout record, and its payment history must be kept. A cancelled event stays on file for that reason.',
        },
        { status: 400 }
      );
    }

    let deleted;
    try {
      [deleted] = await sql`
        WITH ok AS (
          SELECT 1 AS one
          WHERE NOT EXISTS (SELECT 1 FROM orders WHERE event_id = ${id} AND payment_status IN ('paid', 'refunded'))
            AND NOT EXISTS (SELECT 1 FROM organizer_payouts WHERE event_id = ${id})
        ),
        dead AS (
          SELECT id FROM orders
          WHERE event_id = ${id} AND payment_status NOT IN ('paid', 'refunded')
            AND EXISTS (SELECT 1 FROM ok)
        ),
        d_payment_events AS (DELETE FROM payment_events WHERE order_id IN (SELECT id FROM dead)),
        d_tickets        AS (DELETE FROM tickets        WHERE order_id IN (SELECT id FROM dead)),
        d_messages       AS (DELETE FROM messages       WHERE event_id = ${id} AND EXISTS (SELECT 1 FROM ok)),
        d_staff          AS (DELETE FROM event_staff    WHERE event_id = ${id} AND EXISTS (SELECT 1 FROM ok)),
        -- The status condition is written on the DELETE itself (not only in "dead"):
        -- if a payment commits while this runs, Postgres re-checks THIS condition on
        -- the updated row, skips the now-paid order, and the event delete then fails
        -- its foreign key and rolls everything back. A condition hidden in a helper
        -- subquery is not re-checked, which let a paid order be deleted.
        d_orders         AS (DELETE FROM orders
                             WHERE event_id = ${id}
                               AND payment_status NOT IN ('paid', 'refunded')
                               AND EXISTS (SELECT 1 FROM ok))
        DELETE FROM events WHERE id = ${id} AND EXISTS (SELECT 1 FROM ok)
        RETURNING id, title
      `;
    } catch (err: any) {
      // An order was paid in the instant between the checks above and the
      // delete: the database refuses (foreign key) and rolls everything back.
      if (err?.code === '23503') {
        return NextResponse.json(
          { error: 'This event just received an order, so it was not deleted. Refresh and review it.' },
          { status: 409 }
        );
      }
      throw err;
    }

    if (!deleted) {
      return NextResponse.json(
        { error: 'This event changed while deleting, so nothing was deleted. Refresh and try again.' },
        { status: 409 }
      );
    }

    await writeAuditLog({
      actorId: session.userId,
      action: 'event.delete',
      entityType: 'event',
      entityId: id,
      meta: { title: deleted.title, status: event.status },
    });

    return NextResponse.json({ success: true, deleted: deleted.title });
  } catch (error) {
    // Details stay in the server log; the client gets no SQL / constraint names.
    console.error('Admin delete event error:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}

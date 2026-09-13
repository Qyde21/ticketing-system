import { sql } from '@/lib/db';

export type Reservation = {
  ticketTypeId: string;
  quantity: number;
  flashApplied: boolean;
  eventId: string;
  unitPrice: number;
  lineTotal: number;
};

/**
 * Atomically reserves `quantity` units of a ticket type, respecting
 * quantity_total and any active flash-sale cap. Uses SELECT ... FOR UPDATE
 * plus a conditional UPDATE so concurrent requests can never oversell.
 * Callers MUST call releaseReservation() if anything downstream fails
 * after a successful reservation, to give the inventory back.
 */
export async function reserveTier(ticketTypeId: string, quantity: number): Promise<
  | { ok: true; reservation: Reservation }
  | { ok: false; error: string; status: number }
> {
  if (quantity < 1) {
    return { ok: false, error: 'Quantity must be at least 1', status: 400 };
  }

  const basicTickets = await sql`
    SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
    FROM ticket_types WHERE id::text = ${ticketTypeId}
  `;
  const basicTicketType = basicTickets[0];
  if (!basicTicketType) {
    return { ok: false, error: 'Ticket type not found', status: 404 };
  }
  if (basicTicketType.max_per_order && quantity > basicTicketType.max_per_order) {
    return {
      ok: false,
      error: `Maximum ${basicTicketType.max_per_order} tickets per order for this tier`,
      status: 400,
    };
  }

  const reserved = await sql`
    WITH current AS (
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order,
             flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
             flash_sale_quantity_cap, flash_sale_quantity_sold
      FROM ticket_types
      WHERE id::text = ${ticketTypeId}
      FOR UPDATE
    ),
    eligible AS (
      SELECT *,
        (flash_sale_price_kes IS NOT NULL
          AND now() BETWEEN flash_sale_starts_at AND flash_sale_ends_at
          AND (flash_sale_quantity_cap IS NULL OR flash_sale_quantity_sold + ${quantity} <= flash_sale_quantity_cap)
        ) AS flash_applies
      FROM current
    )
    UPDATE ticket_types t
    SET quantity_sold = t.quantity_sold + ${quantity},
        flash_sale_quantity_sold = t.flash_sale_quantity_sold + (CASE WHEN eligible.flash_applies THEN ${quantity} ELSE 0 END)
    FROM eligible
    WHERE t.id = eligible.id
      AND eligible.quantity_sold + ${quantity} <= eligible.quantity_total
    RETURNING t.id, t.event_id, t.price_kes, eligible.flash_applies, eligible.flash_sale_price_kes
  `;
  const ticketType = reserved[0];
  if (!ticketType) {
    const remaining = Number(basicTicketType.quantity_total || 0) - Number(basicTicketType.quantity_sold || 0);
    return {
      ok: false,
      error: `Only ${Math.max(0, remaining)} ticket(s) remaining for one of the selected tiers`,
      status: 400,
    };
  }

  const unitPrice = ticketType.flash_applies
    ? Number(ticketType.flash_sale_price_kes)
    : Number(ticketType.price_kes || 0);

  return {
    ok: true,
    reservation: {
      ticketTypeId: ticketType.id,
      quantity,
      flashApplied: !!ticketType.flash_applies,
      eventId: ticketType.event_id,
      unitPrice,
      lineTotal: unitPrice * quantity,
    },
  };
}

/** Gives back inventory reserved by reserveTier(), e.g. after a downstream failure. */
export async function releaseReservation(r: Reservation) {
  await sql`
    UPDATE ticket_types
    SET quantity_sold = GREATEST(0, quantity_sold - ${r.quantity}),
        flash_sale_quantity_sold = GREATEST(0, flash_sale_quantity_sold - ${r.flashApplied ? r.quantity : 0})
    WHERE id = ${r.ticketTypeId}
  `;
}

/**
 * True when the event is no longer eligible for refunds / new sales.
 * Prefer end_at; if missing, fall back to start_at. Completed/cancelled always closed.
 */
export function isEventEnded(event: {
  status?: string | null;
  start_at?: string | Date | null;
  end_at?: string | Date | null;
}): boolean {
  const status = String(event.status || '').toLowerCase();
  if (status === 'completed' || status === 'cancelled') return true;

  const endRaw = event.end_at ?? event.start_at;
  if (!endRaw) return false;

  const end = endRaw instanceof Date ? endRaw : new Date(endRaw);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < Date.now();
}

export function canRefundOrder(
  order: { payment_status?: string | null },
  event: {
    status?: string | null;
    start_at?: string | Date | null;
    end_at?: string | Date | null;
  }
): boolean {
  const paid = String(order.payment_status || '').toLowerCase() === 'paid';
  return paid && !isEventEnded(event);
}

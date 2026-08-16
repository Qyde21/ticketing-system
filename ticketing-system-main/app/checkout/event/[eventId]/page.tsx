import { sql } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MultiCheckoutForm from './MultiCheckoutForm';

export const dynamic = 'force-dynamic';

type SearchParams = { items?: string };

export default async function EventCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const itemsRaw = sp?.items || '';

  const [event] = await sql`
    SELECT id, title, slug, venue_name, start_at, end_at, status, cover_image_url
    FROM events WHERE id = ${eventId}
  `;
  if (!event) notFound();

  const requested = itemsRaw
    .split(',')
    .map((part) => {
      const [id, q] = part.split(':');
      const quantity = parseInt(q || '0', 10);
      if (!id || !Number.isFinite(quantity) || quantity < 1) return null;
      return { ticketTypeId: id.trim(), quantity };
    })
    .filter(Boolean) as Array<{ ticketTypeId: string; quantity: number }>;

  if (requested.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-white">
        <Link href={`/events/${event.slug || event.id}`} className="text-indigo-400 hover:underline text-sm font-semibold">
          ← Back to Event
        </Link>
        <h1 className="text-2xl font-extrabold mt-4 mb-2">No tickets selected</h1>
        <p className="text-gray-400 text-sm">Go back to the event page and choose quantities for one or more tiers.</p>
      </main>
    );
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold, max_per_order,
           flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
           flash_sale_quantity_cap, flash_sale_quantity_sold
    FROM ticket_types
    WHERE event_id = ${eventId}
  `;
  const byId = new Map(ticketTypes.map((t: any) => [String(t.id), t]));

  const now = new Date();
  const lines: any[] = [];
  for (const req of requested) {
    const t = byId.get(String(req.ticketTypeId));
    if (!t) continue;
    const remaining = Math.max(0, Number(t.quantity_total || 0) - Number(t.quantity_sold || 0));
    const maxPer = Number(t.max_per_order || 10);
    const quantity = Math.min(req.quantity, remaining, maxPer);
    if (quantity < 1) continue;

    const flashCapReached =
      t.flash_sale_quantity_cap !== null &&
      t.flash_sale_quantity_cap !== undefined &&
      Number(t.flash_sale_quantity_sold || 0) >= Number(t.flash_sale_quantity_cap);
    const flashActive =
      t.flash_sale_price_kes !== null &&
      t.flash_sale_price_kes !== undefined &&
      t.flash_sale_starts_at &&
      t.flash_sale_ends_at &&
      now >= new Date(t.flash_sale_starts_at) &&
      now <= new Date(t.flash_sale_ends_at) &&
      !flashCapReached;
    const unitPrice = flashActive ? Number(t.flash_sale_price_kes) : Number(t.price_kes);
    lines.push({
      id: t.id,
      name: flashActive ? `${t.name} (Flash Sale)` : t.name,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      flashActive,
    });
  }

  if (lines.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-white">
        <Link href={`/events/${event.slug || event.id}`} className="text-indigo-400 hover:underline text-sm font-semibold">
          ← Back to Event
        </Link>
        <h1 className="text-2xl font-extrabold mt-4 mb-2">Tickets unavailable</h1>
        <p className="text-gray-400 text-sm">Those tiers are sold out or invalid. Pick again on the event page.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-white">
      <Link href={`/events/${event.slug || event.id}`} className="text-indigo-400 hover:underline text-sm font-semibold">
        ← Back to Event
      </Link>
      <h1 className="text-2xl font-extrabold mt-4 mb-1">Checkout</h1>
      <p className="text-gray-400 text-sm mb-6">{event.title}</p>
      <MultiCheckoutForm event={{ id: event.id, title: event.title }} lines={lines} />
    </main>
  );
}
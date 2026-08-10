import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import FlashSaleManager from './FlashSaleManager';

export const dynamic = 'force-dynamic';

export default async function FlashSalesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Unauthorized.</div>;
  }

  const [event] = await sql`SELECT id, title, organizer_id FROM events WHERE id = ${id}`;
  if (!event) return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Event not found.</div>;

  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Not authorized for this event.</div>;
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold,
           flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
           flash_sale_quantity_cap, flash_sale_quantity_sold
    FROM ticket_types
    WHERE event_id = ${id}
    ORDER BY price_kes ASC
  `;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">Flash Sales</h1>
      <p className="text-gray-400 text-sm mb-6">{event.title} &middot; Discount a ticket tier for a limited time and/or limited quantity â€” no code needed at checkout.</p>

      <FlashSaleManager ticketTypes={ticketTypes as any} />
    </div>
  );
}

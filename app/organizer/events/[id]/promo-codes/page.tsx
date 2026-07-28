import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PromoCodeManager from './PromoCodeManager';

export const dynamic = 'force-dynamic';

export default async function PromoCodesPage({ params }: { params: Promise<{ id: string }> }) {
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

  const codes = await sql`
    SELECT id, code, discount_type, discount_value, max_uses, uses_count, expires_at, active, created_at
    FROM promo_codes
    WHERE event_id = ${id}
    ORDER BY created_at DESC
  `;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">Promo Codes</h1>
      <p className="text-gray-400 text-sm mb-6">{event.title}</p>

      <PromoCodeManager eventId={event.id} initialCodes={codes as any} />
    </div>
  );
}

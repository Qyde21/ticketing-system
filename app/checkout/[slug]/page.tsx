import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import CheckoutForm from './CheckoutForm';

export default async function CheckoutPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  let events = await sql`
    SELECT * FROM events WHERE slug = ${slug} OR id::text = ${slug} LIMIT 1
  `;

  if (!events || events.length === 0) {
    events = await sql`
      SELECT * FROM events WHERE LOWER(title) LIKE ${'%' + slug.replace(/-/g, ' ').toLowerCase() + '%'} LIMIT 1
    `;
  }

  if (!events || events.length === 0) {
    notFound();
  }

  const event = Array.isArray(events) ? events[0] : (events.rows?.[0] || events);

  if (!event || !event.id) {
    notFound();
  }

  const ticketTypes = await sql`
    SELECT * FROM ticket_types WHERE event_id = ${event.id}
  `.catch(() => []);

  const safeTicketTypes = Array.isArray(ticketTypes) ? ticketTypes : (ticketTypes.rows || []);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <p className="text-gray-400 mb-6">{event.description}</p>
      
      <CheckoutForm event={event} ticketTypes={safeTicketTypes} />
    </div>
  );
}
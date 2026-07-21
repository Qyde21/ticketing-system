import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function EventDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = await params;
  const identifier = resolvedParams.id;

  let events: any = await sql`
    SELECT * FROM events WHERE id::text = ${identifier} OR slug = ${identifier} LIMIT 1
  `;

  if (!events || (Array.isArray(events) && events.length === 0) || (events.rows && events.rows.length === 0)) {
    events = await sql`
      SELECT * FROM events WHERE LOWER(title) LIKE ${'%' + identifier.replace(/-/g, ' ').toLowerCase() + '%'} LIMIT 1
    `;
  }

  const rows = Array.isArray(events) ? events : (events?.rows || []);

  if (rows.length === 0) {
    notFound();
  }

  const event = rows[0];

  if (!event || !event.id) {
    notFound();
  }

  const lookupKey = event.slug || event.id;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-white">
      <h1 className="text-4xl font-extrabold mb-4">{event.title}</h1>
      <p className="text-gray-300 text-lg mb-8 leading-relaxed">{event.description}</p>
      
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 space-y-3">
        <p><strong className="text-gray-400">Date:</strong> {event.date || 'TBA'}</p>
        <p><strong className="text-gray-400">Location:</strong> {event.location || 'Online / Venue TBA'}</p>
      </div>

      <Link 
        href={`/checkout/${lookupKey}`}
        className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 text-center"
      >
        Buy Tickets Now
      </Link>
    </div>
  );
}

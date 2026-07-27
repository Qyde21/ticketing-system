import { sql } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizerEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: organizerId } = await params;

  // Fetch organizer details
  const [organizer] = await sql`
    SELECT full_name, email FROM users WHERE id = ${organizerId} AND role = 'organizer'
  `;

  if (!organizer) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Organizer not found.</div>;
  }

  // Fetch events for this specific organizer
  const events = await sql`
    SELECT id, title, status, start_at, cover_image_url
    FROM events
    WHERE organizer_id = ${organizerId}
    ORDER BY created_at DESC
  `;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <div className="mb-5">
        <Link href="/admin/organizers" className="text-indigo-400 hover:underline text-sm">
          &larr; Back to Organizers
        </Link>
      </div>

      <h1 className="text-2xl font-extrabold mb-1">Events by {organizer.full_name}</h1>
      <p className="text-gray-400 text-sm mb-6">{organizer.email}</p>

      {events.length === 0 ? (
        <p className="text-gray-400">No events found for this organizer.</p>
      ) : (
        <ul className="list-none p-0 m-0">
          {events.map((e: any) => (
            <li
              key={e.id}
              className="flex gap-4 mb-4 items-center bg-gray-900 border border-gray-800 rounded-xl p-3"
            >
              {/* Thumbnail */}
              <div className="w-20 h-15 rounded-lg overflow-hidden flex-shrink-0 bg-indigo-600 flex items-center justify-center" style={{ width: 80, height: 60 }}>
                {e.cover_image_url ? (
                  <img src={e.cover_image_url} alt={e.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xs text-center p-1">{e.title}</span>
                )}
              </div>

              {/* Event Info & Action Buttons */}
              <div className="flex-1">
                <strong className="text-white">{e.title}</strong>
                <div className="text-xs text-gray-400 mt-0.5">
                  {e.status} &middot; {new Date(e.start_at).toLocaleDateString()}
                </div>

                {/* Dashboard Action Links mimicking the working Organizer structure */}
                <div className="flex gap-2 flex-wrap mt-1.5 text-xs">
                  {e.status === 'published' && (
                    <>
                      <Link href={`/scan/${e.id}`} className="text-indigo-400 hover:text-cyan-400">Scan tickets</Link>
                      <Link href={`/organizer/events/${e.id}/scan-overview`} className="text-indigo-400 hover:text-cyan-400">Scan overview</Link>
                    </>
                  )}
                  <Link href={`/organizer/events/${e.id}/orders`} className="text-indigo-400 hover:text-cyan-400">Orders</Link>
                  <Link href={`/organizer/events/${e.id}/messages`} className="text-indigo-400 hover:text-cyan-400">Messages</Link>
                  <Link href={`/organizer/events/${e.id}/edit`} className="text-indigo-400 hover:text-cyan-400">Edit cover</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

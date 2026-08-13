import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import StaffManager from './StaffManager';

export const dynamic = 'force-dynamic';

export default async function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const session = await getSession();

  if (!session) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Please log in.</div>;
  }

  const [event] = await sql`SELECT id, title, organizer_id FROM events WHERE id = ${eventId}`;
  if (!event) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Event not found.</div>;
  }

  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Not authorized for this event.</div>;
  }

  const eventEnded =
    event.status === 'completed' ||
    (event.status !== 'cancelled' &&
      (event.end_at ? new Date(event.end_at as string) : new Date(event.start_at as string)) < new Date());

  if (eventEnded) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-white">
        <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-2xl font-extrabold mt-2 mb-1">Door staff</h1>
        <p className="text-gray-400 text-sm mb-4">{event.title}</p>
        <div className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-4 text-sm text-gray-300">
          This event has ended. Door staff invites and scanning are closed.
        </div>
      </div>
    );
  }

  const staff = await sql`
    SELECT u.id, u.full_name, u.email
    FROM event_staff es
    JOIN users u ON u.id = es.user_id
    WHERE es.event_id = ${eventId}
    ORDER BY u.full_name ASC
  `;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">Door Staff</h1>
      <p className="text-gray-400 text-sm mb-6">{event.title} &middot; People you add here can scan tickets for this event only.</p>

      <StaffManager eventId={eventId} initialStaff={staff as any} />
    </div>
  );
}

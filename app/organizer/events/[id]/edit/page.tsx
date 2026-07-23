import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CoverUpload from './CoverUpload';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const [event] = await sql`
    SELECT id, title, cover_image_url, organizer_id FROM events WHERE id = ${id}
  `;

  if (!event) {
    return <div className="max-w-lg mx-auto py-12 px-4 text-white">Event not found.</div>;
  }

  const isOwner = session.userId === event.organizer_id;
  const isAdmin = session.role === 'admin';
  if (!isOwner && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-white">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-white mb-1">Access Denied</p>
          <p className="text-sm text-gray-400">You don&apos;t have permission to edit this event.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4 text-white">
      <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-1">
        Edit Cover Image
      </h1>
      <h2 className="text-gray-400 mb-6">{event.title}</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt="Current cover"
            className="w-full max-h-52 object-cover rounded-xl mb-4"
          />
        ) : (
          <p className="text-gray-500 mb-4">No cover image yet.</p>
        )}
        <CoverUpload eventId={event.id} />
      </div>
    </div>
  );
}

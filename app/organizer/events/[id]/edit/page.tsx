import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EditEventForm from './EditEventForm';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const [event] = await sql`
    SELECT e.id, e.title, e.description, e.category, e.venue_name, e.venue_address,
           e.start_at, e.end_at, e.cover_image_url, e.organizer_id, e.status,
           u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.id = ${id}
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

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold, max_per_order
    FROM ticket_types WHERE event_id = ${id} ORDER BY created_at ASC
  `;

  return (
    <EditEventForm
      event={{
        id: event.id,
        title: event.title,
        description: event.description || '',
        category: event.category || '',
        venueName: event.venue_name || '',
        venueAddress: event.venue_address || '',
        startAt: event.start_at ? new Date(event.start_at).toISOString().slice(0, 16) : '',
        endAt: event.end_at ? new Date(event.end_at).toISOString().slice(0, 16) : '',
        coverImageUrl: event.cover_image_url || '',
      }}
      ticketTypes={ticketTypes.map((tt: any) => ({
        id: tt.id,
        name: tt.name,
        priceKes: String(tt.price_kes),
        quantityTotal: String(tt.quantity_total),
        quantitySold: Number(tt.quantity_sold),
        maxPerOrder: tt.max_per_order,
      }))}
      isAdminEditingOther={isAdmin && !isOwner}
      organizerLabel={event.organizer_name || event.organizer_email}
    />
  );
}

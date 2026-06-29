import { sql } from '@/lib/db';
import Scanner from './Scanner';

export default async function ScanPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [event] = await sql`SELECT id, title FROM events WHERE id = ${eventId}`;

  if (!event) {
    return <div style={{ margin: '2rem' }}>Event not found.</div>;
  }

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto' }}>
      <h1>Check-in: {event.title}</h1>
      <Scanner eventId={event.id} />
    </div>
  );
}
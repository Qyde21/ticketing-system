import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete child records first to satisfy FK constraints
    // Delete ticket purchases / tickets associated with ticket_types for this event
    await sql`
      DELETE FROM tickets 
      WHERE ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id = ${id})
    `;

    // Delete ticket types for this event
    await sql`DELETE FROM ticket_types WHERE event_id = ${id}`;

    // Delete orders / payouts associated with this event if applicable
    await sql`DELETE FROM orders WHERE event_id = ${id}`;

    // Finally delete the event
    await sql`DELETE FROM events WHERE id = ${id}`;

    return NextResponse.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

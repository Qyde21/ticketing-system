import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// A review only makes sense once the event has actually happened. Cancelled
// events never happened, so they're excluded rather than treated as "ended".
function isReviewable(event: { status?: string; start_at?: string | Date; end_at?: string | Date | null }) {
  if (event.status === 'cancelled') return false;
  if (event.status === 'completed') return true;
  const end = event.end_at ? new Date(event.end_at) : event.start_at ? new Date(event.start_at) : null;
  return !!end && end < new Date();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  const [event] = await sql`SELECT id FROM events WHERE id = ${eventId}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const reviews = await sql`
    SELECT r.id, r.rating, r.comment, r.created_at, u.full_name
    FROM event_reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ${eventId}
    ORDER BY r.created_at DESC
  `;

  const [agg] = await sql`
    SELECT COUNT(*)::int AS review_count, COALESCE(AVG(rating), 0)::float AS average_rating
    FROM event_reviews
    WHERE event_id = ${eventId}
  `;

  return NextResponse.json({
    reviews,
    reviewCount: agg?.review_count ?? 0,
    averageRating: agg?.average_rating ?? 0,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Please log in to leave a review' }, { status: 401 });
  }

  const { id: eventId } = await params;

  const [event] = await sql`
    SELECT id, organizer_id, status, start_at, end_at FROM events WHERE id = ${eventId}
  `;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (event.organizer_id === session.userId) {
    return NextResponse.json({ error: "You can't review your own event" }, { status: 400 });
  }

  if (!isReviewable(event)) {
    return NextResponse.json(
      { error: event.status === 'cancelled' ? 'Cancelled events cannot be reviewed' : 'This event hasn\'t ended yet' },
      { status: 400 }
    );
  }

  const [buyerCheck] = await sql`
    SELECT 1 FROM orders
    WHERE event_id = ${eventId} AND payment_status = 'paid' AND LOWER(buyer_email) = ${session.email.toLowerCase()}
    LIMIT 1
  `;
  if (!buyerCheck) {
    return NextResponse.json({ error: 'Only ticket holders can review this event' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rating = Number(body.rating);
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be a whole number between 1 and 5' }, { status: 400 });
  }

  try {
    const [review] = await sql`
      INSERT INTO event_reviews (event_id, user_id, rating, comment)
      VALUES (${eventId}, ${session.userId}, ${rating}, ${comment || null})
      RETURNING id, rating, comment, created_at
    `;
    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    if (String(err?.message || '').includes('event_reviews_event_id_user_id_key') || err?.code === '23505') {
      return NextResponse.json({ error: 'You already reviewed this event' }, { status: 409 });
    }
    throw err;
  }
}

import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import EventList from '@/components/EventList';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

async function getOrganizer(id: string) {
  const rows: any = await sql`
    SELECT
      u.id,
      u.full_name,
      u.status,
      COALESCE(op.business_name, u.full_name) AS display_name,
      COALESCE(op.is_verified, false) AS is_verified,
      op.created_at AS profile_created_at
    FROM users u
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    WHERE u.id::text = ${id} AND u.role = 'organizer'
    LIMIT 1
  `;
  const list = Array.isArray(rows) ? rows : (rows?.rows || []);
  return list[0] || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const organizer = await getOrganizer(id);

  if (!organizer || organizer.status === 'suspended') {
    return { title: 'Organizer not found — TicketHub' };
  }

  return {
    title: `${organizer.display_name} — TicketHub`,
    description: `Events by ${organizer.display_name} on TicketHub.`,
  };
}

export default async function OrganizerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizer = await getOrganizer(id);

  if (!organizer || organizer.status === 'suspended') {
    notFound();
  }

  const events: any = await sql`
    SELECT
      e.id, e.title, e.slug, e.venue_name, e.start_at, e.end_at, e.status,
      e.cover_image_url, e.category, e.organizer_id,
      true AS organizer_verified,
      COALESCE(SUM(tt.quantity_total), 0) AS total_capacity,
      COALESCE(SUM(tt.quantity_sold), 0) AS total_sold,
      BOOL_OR(
        tt.flash_sale_price_kes IS NOT NULL
        AND tt.flash_sale_starts_at IS NOT NULL
        AND tt.flash_sale_ends_at IS NOT NULL
        AND tt.flash_sale_starts_at <= NOW()
        AND tt.flash_sale_ends_at >= NOW()
        AND (
          tt.flash_sale_quantity_cap IS NULL
          OR tt.flash_sale_quantity_sold < tt.flash_sale_quantity_cap
        )
      ) AS has_active_flash
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.organizer_id = ${organizer.id} AND e.status IN ('published', 'completed')
    GROUP BY e.id
    ORDER BY e.start_at ASC
  `;
  const eventRows = Array.isArray(events) ? events : (events?.rows || []);
  // organizer_verified is constant for every row here (same organizer), so
  // stamp it from the profile lookup rather than trusting the placeholder above.
  const rowsWithVerified = eventRows.map((e: any) => ({ ...e, organizer_verified: organizer.is_verified }));

  const now = new Date();
  const upcomingEvents = rowsWithVerified.filter((e: any) => {
    if (e.status === 'completed') return false;
    const endDate = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
    return endDate >= now;
  });
  const pastEvents = rowsWithVerified.filter((e: any) => {
    if (e.status === 'completed') return true;
    const endDate = e.end_at ? new Date(e.end_at) : new Date(e.start_at);
    return endDate < now;
  });

  const memberSince = organizer.profile_created_at
    ? new Date(organizer.profile_created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 text-white">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <h1 className="text-3xl font-extrabold">{organizer.display_name}</h1>
        {organizer.is_verified && (
          <span className="inline-flex items-center gap-1 bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            Verified Organizer
          </span>
        )}
      </div>
      {memberSince && (
        <p className="text-gray-400 text-sm mb-10">Organizing events on TicketHub since {memberSince}</p>
      )}
      {!memberSince && <div className="mb-10" />}

      <h2 className="text-xl font-bold mb-4">Upcoming events</h2>
      {upcomingEvents.length > 0 ? (
        <div className="mb-12">
          <EventList events={upcomingEvents} showFilters={false} />
        </div>
      ) : (
        <p className="text-gray-400 mb-12">No upcoming events right now.</p>
      )}

      {pastEvents.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">Past events</h2>
          <EventList events={pastEvents} showFilters={false} />
        </>
      )}
    </div>
  );
}

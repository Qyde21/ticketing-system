import { ImageResponse } from 'next/og';
import { sql } from '@/lib/db';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const alt = 'TicketHub event';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: identifier } = await params;

  const [event] = await sql`
    SELECT title, venue_name, start_at, cover_image_url
    FROM events WHERE id::text = ${identifier} OR slug = ${identifier} LIMIT 1
  `;

  const fontData = await readFile(
    path.join(process.cwd(), 'public/fonts/LiberationSans-Bold.ttf')
  );
  const badgeData = await readFile(
    path.join(process.cwd(), 'public/logo-badge.png')
  );
  const badgeBase64 = `data:image/png;base64,${badgeData.toString('base64')}`;

  const dateStr = event?.start_at
    ? new Date(event.start_at).toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';
  const venue = event?.venue_name || 'Venue TBA';
  const rawTitle = event?.title || 'TicketHub Event';
  const title = rawTitle.length > 62 ? rawTitle.slice(0, 59) + 'â€¦' : rawTitle;
  const metaLine = [dateStr, venue].filter(Boolean).join('   â€¢   ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#0a0a1c',
          backgroundImage: event?.cover_image_url
            ? undefined
            : 'linear-gradient(135deg, #0a0a1c 0%, #1a1536 100%)',
        }}
      >
        {event?.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_image_url}
            width={1200}
            height={630}
            style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
          />
        )}

        {/* Dark gradient so text stays legible over any cover photo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'linear-gradient(0deg, rgba(8,8,20,0.94) 8%, rgba(8,8,20,0.30) 52%, rgba(8,8,20,0.55) 100%)',
          }}
        />

        {/* Badge + wordmark, top-left */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 56,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeBase64} width={64} height={64} />
          <div style={{ marginLeft: 14, display: 'flex', fontSize: 34 }}>
            <span style={{ color: '#818cf8' }}>Ticket</span>
            <span style={{ color: '#22d3ee' }}>Hub</span>
          </div>
        </div>

        {/* Title + date/venue, bottom */}
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: 56,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize: 56,
              color: '#f3f3f8',
              lineHeight: 1.15,
              display: 'flex',
            }}
          >
            {title}
          </div>
          {metaLine && (
            <div style={{ marginTop: 18, fontSize: 28, color: '#c9a24b', display: 'flex' }}>
              {metaLine}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'LiberationSans', data: fontData, weight: 700, style: 'normal' }],
    }
  );
}


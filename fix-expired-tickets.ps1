# Run this from your project root: C:\Users\user\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File fix-expired-tickets.ps1
#
# Fixes: unscanned tickets on events that have already ended were still
# displaying as "valid" everywhere (ticket page, my-tickets, attendee
# dashboard, guest magic-link view). Adds a shared getTicketDisplayStatus()
# helper in lib/tickets.ts and wires it into every place a ticket's status
# is shown, so an unscanned ticket on a finished event now reads "expired"
# instead of "valid". No DB migration needed - this is display-layer only,
# the underlying valid/used status in the database is untouched.

$ErrorActionPreference = "Stop"
$script:anyFailed = $false
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-ClaudeFile($path, $content) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

Write-Host "Writing: lib\tickets.ts" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendTicketEmail } from '@/lib/email';
import { sendTicketConfirmationSms } from '@/lib/sms';

export type TicketDisplayStatus = 'valid' | 'used' | 'cancelled' | 'expired';

/**
 * Tickets never get their DB status flipped when an event ends unscanned -
 * the row stays 'valid' forever (this is intentional, see finalizePaidOrder).
 * Anywhere a ticket's status is shown to a person, use this to derive what
 * they should actually see: an unscanned 'valid' ticket on an event that has
 * already ended should read as 'expired', not 'valid'.
 */
export function getTicketDisplayStatus(
  ticketStatus: string | null | undefined,
  event: { status?: string | null; start_at?: string | Date | null; end_at?: string | Date | null } | null | undefined
): TicketDisplayStatus {
  if (ticketStatus === 'used' || ticketStatus === 'cancelled') {
    return ticketStatus;
  }
  if (event) {
    const ended =
      event.status === 'completed' ||
      (event.status !== 'cancelled' &&
        (() => {
          const end = event.end_at ? new Date(event.end_at) : event.start_at ? new Date(event.start_at) : null;
          return end ? end < new Date() : false;
        })());
    if (ended) return 'expired';
  }
  return 'valid';
}

/**
 * Marks an order as paid, generates real ticket rows, and emails the buyer.
 * Safe to call more than once for the same order - if tickets already exist,
 * returns those codes instead of generating duplicates.
 *
 * Inventory (quantity_sold) is reserved atomically when the order is created
 * (see app/api/orders/route.ts). This function must NOT increment quantity_sold
 * again, or pending holds would be double-counted.
 */
export async function finalizePaidOrder(orderId: string, baseUrl: string): Promise<string[]> {
  const [order] = await sql`
    SELECT id, payment_status, ticket_type_id, quantity, buyer_name, buyer_email, buyer_phone, event_id, promo_code_id
    FROM orders WHERE id = ${orderId}
  `;

  if (!order) return [];

  // Already finalized with tickets - return existing codes (idempotent).
  const existing = await sql`SELECT ticket_code FROM tickets WHERE order_id = ${order.id}`;
  if (existing.length > 0) {
    if (order.payment_status !== 'paid') {
      await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${order.id}`;
    }
    return existing.map((t) => String(t.ticket_code));
  }

  // Mark paid if still pending. Promo use is counted only on the first transition to paid.
  if (order.payment_status !== 'paid') {
    await sql`UPDATE orders SET payment_status = 'paid' WHERE id = ${order.id}`;

    if (order.promo_code_id) {
      // Atomic guard: only increments if still under the limit, so the
      // stored count can never overshoot max_uses even under concurrent
      // near-simultaneous redemptions. (Payment has already succeeded via
      // Paystack by this point, so a losing concurrent order still keeps
      // its discount - this guard protects future validation, not this
      // specific edge case, which is an acceptable tradeoff.)
      await sql`
        UPDATE promo_codes
        SET uses_count = uses_count + 1
        WHERE id = ${order.promo_code_id}
          AND (max_uses IS NULL OR uses_count < max_uses)
      `;
    }
  }

  const generatedCodes: string[] = [];
  for (let i = 0; i < order.quantity; i++) {
    const ticketCode = nanoid(10).toUpperCase();
    await sql`
      INSERT INTO tickets (order_id, ticket_type_id, ticket_code, holder_name, holder_email, status)
      VALUES (${order.id}, ${order.ticket_type_id}, ${ticketCode}, ${order.buyer_name}, ${order.buyer_email}, 'valid')
    `;
    generatedCodes.push(ticketCode);
  }

  // quantity_sold is reserved atomically at order creation - do not increment here.

  const [eventDetails] = await sql`
    SELECT title, venue_name, start_at FROM events WHERE id = ${order.event_id}
  `;

  if (eventDetails) {
    try {
      await sendTicketEmail({
        toEmail: order.buyer_email,
        buyerName: order.buyer_name,
        eventTitle: eventDetails.title,
        venueName: eventDetails.venue_name,
        startAt: eventDetails.start_at,
        ticketCodes: generatedCodes,
        baseUrl,
      });
    } catch (emailErr) {
      console.error('Failed to send ticket email:', emailErr);
    }

    if (order.buyer_phone) {
      try {
        await sendTicketConfirmationSms({
          toPhone: order.buyer_phone,
          eventTitle: eventDetails.title,
          quantity: order.quantity,
          ticketCodes: generatedCodes,
        });
      } catch (smsErr) {
        console.error('Failed to send ticket confirmation SMS:', smsErr);
      }
    }
  }

  return generatedCodes;
}

'@
Write-ClaudeFile "lib\tickets.ts" $content

Write-Host "Writing: app\tickets\[code]\page.tsx" -ForegroundColor Cyan
$content = @'
﻿import { sql } from '@/lib/db';
import QRCode from 'qrcode';
import EventTicket from '@/components/EventTicket';
import AddToCalendarButton from '@/components/AddToCalendarButton';
import { getTicketDisplayStatus } from '@/lib/tickets';

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [ticket] = await sql`
    SELECT t.ticket_code, t.holder_name, t.status, t.checked_in_at,
           tt.name AS ticket_type_name,
           e.title AS event_title, e.venue_name, e.start_at, e.end_at, e.status AS event_status,
           e.cover_image_url
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN orders o ON o.id = t.order_id
    JOIN events e ON e.id = o.event_id
    WHERE t.ticket_code = ${code}
  `;

  if (!ticket) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center text-white">
        <p className="text-lg font-semibold">Ticket not found.</p>
      </div>
    );
  }

  const qrDataUrl = await QRCode.toDataURL(ticket.ticket_code, {
    margin: 1,
    width: 280,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const isUsed = ticket.status === 'used';
  const displayStatus = getTicketDisplayStatus(ticket.status, {
    status: ticket.event_status,
    start_at: ticket.start_at,
    end_at: ticket.end_at,
  });
  const isExpired = displayStatus === 'expired';

  return (
    <div className="min-h-[70vh] w-full px-3 sm:px-6 py-6 sm:py-10 text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-1">Your ticket</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">{ticket.event_title}</h1>
          <p className="text-sm text-gray-400 mt-1">Show this at the entrance — QR or barcode both work</p>
        </div>

        <EventTicket
          eventTitle={ticket.event_title}
          ticketTypeName={ticket.ticket_type_name}
          venueName={ticket.venue_name}
          startAt={ticket.start_at}
          endAt={ticket.end_at}
          holderName={ticket.holder_name}
          ticketCode={ticket.ticket_code}
          qrDataUrl={qrDataUrl}
          status={ticket.status}
          isExpired={isExpired}
          checkedInAt={ticket.checked_in_at}
          coverImageUrl={ticket.cover_image_url}
        />

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 text-sm">
          <p className="text-gray-400">
            Status:{' '}
            <strong className={isUsed ? 'text-red-400' : isExpired ? 'text-gray-400' : 'text-emerald-400'}>
              {displayStatus}
            </strong>
          </p>
          <AddToCalendarButton
            title={ticket.event_title}
            location={ticket.venue_name}
            startAt={ticket.start_at}
            endAt={ticket.end_at}
          />
        </div>
      </div>
    </div>
  );
}
'@
Write-ClaudeFile "app\tickets\[code]\page.tsx" $content

Write-Host "Writing: components\EventTicket.tsx" -ForegroundColor Cyan
$content = @'
﻿'use client';

import TicketBarcode from '@/components/TicketBarcode';

export type EventTicketProps = {
  eventTitle: string;
  ticketTypeName?: string;
  venueName?: string;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  holderName?: string | null;
  ticketCode: string;
  qrDataUrl: string;
  status?: string;
  isExpired?: boolean;
  checkedInAt?: string | Date | null;
  coverImageUrl?: string | null;
};

function formatWhen(startAt?: string | Date | null) {
  if (!startAt) return 'Date TBA';
  try {
    return new Date(startAt).toLocaleString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(startAt);
  }
}

export default function EventTicket({
  eventTitle,
  ticketTypeName,
  venueName,
  startAt,
  holderName,
  ticketCode,
  qrDataUrl,
  status,
  isExpired = false,
  checkedInAt,
  coverImageUrl,
}: EventTicketProps) {
  const code = String(ticketCode || '').trim();
  const isUsed = status === 'used' || status === 'checked_in';
  const isDimmed = isUsed || isExpired;
  const poster =
    coverImageUrl && String(coverImageUrl).trim()
      ? String(coverImageUrl).trim()
      : null;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <p className="text-[11px] text-gray-500 sm:hidden text-center px-2">
        Tip: rotate your phone for the largest view
      </p>

      <div className="w-full max-w-[920px] mx-auto">
        <div
          className={'relative flex w-full overflow-hidden rounded-2xl shadow-2xl ' + (isDimmed ? 'opacity-90' : '')}
          style={{
            aspectRatio: '2.35 / 1',
            minHeight: 160,
            background: 'linear-gradient(135deg, #1a0508 0%, #4a0e18 40%, #7f1d1d 100%)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <div className="relative flex flex-[1.55] flex-col justify-between p-3 sm:p-5 md:p-6 text-left min-w-0 overflow-hidden">
            {poster && (
              <>
                <img
                  src={poster}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(105deg, rgba(10,2,4,0.92) 0%, rgba(40,8,14,0.78) 45%, rgba(80,15,25,0.65) 100%)',
                  }}
                />
              </>
            )}

            <div className="relative z-10">
              <p
                className="text-[9px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-1"
                style={{ color: '#fbbf24' }}
              >
                TicketHub · Official ticket
              </p>
              <h2
                className="font-black leading-tight text-white line-clamp-2"
                style={{
                  fontSize: 'clamp(0.95rem, 3.6vw, 1.75rem)',
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                }}
              >
                {eventTitle}
              </h2>
              {ticketTypeName && (
                <p
                  className="mt-1 font-semibold"
                  style={{
                    color: '#fde68a',
                    fontSize: 'clamp(0.7rem, 2vw, 0.95rem)',
                  }}
                >
                  {ticketTypeName}
                </p>
              )}
            </div>

            <div className="relative z-10 mt-2 space-y-1 min-w-0">
              <p className="text-white/95 font-medium truncate" style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)' }}>
                <span style={{ color: '#fbbf24' }}>📅 </span>
                {formatWhen(startAt)}
              </p>
              <p className="text-white/90 truncate" style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)' }}>
                <span style={{ color: '#fbbf24' }}>📍 </span>
                {venueName || 'Venue TBA'}
              </p>
              {holderName && (
                <p className="text-white/80 truncate" style={{ fontSize: 'clamp(0.6rem, 1.6vw, 0.8rem)' }}>
                  Holder: {holderName}
                </p>
              )}
              <p
                className="font-mono tracking-wider truncate pt-1"
                style={{ color: '#c7d2fe', fontSize: 'clamp(0.6rem, 1.7vw, 0.8rem)', fontWeight: 700 }}
              >
                {code}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex w-3 sm:w-4 flex-shrink-0 flex-col items-center justify-between py-2" aria-hidden>
            <div className="absolute inset-y-0 left-1/2 w-0 -translate-x-1/2 border-l border-dashed" style={{ borderColor: 'rgba(251,191,36,0.45)' }} />
            <div className="relative z-10 h-3 w-3 sm:h-4 sm:w-4 rounded-full" style={{ background: '#0a0a0a', marginTop: -6 }} />
            <div className="relative z-10 h-3 w-3 sm:h-4 sm:w-4 rounded-full" style={{ background: '#0a0a0a', marginBottom: -6 }} />
          </div>

          <div
            className="relative flex flex-1 flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-w-0"
            style={{ background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)' }}
          >
            <p className="font-bold uppercase tracking-wider text-center" style={{ color: '#7f1d1d', fontSize: 'clamp(0.55rem, 1.5vw, 0.75rem)' }}>
              Scan at door
            </p>
            <div className="rounded-lg sm:rounded-xl border-2 p-1 sm:p-1.5 bg-white" style={{ borderColor: '#7f1d1d' }}>
              <img
                src={qrDataUrl}
                alt={'QR ' + code}
                className="block"
                style={{ width: 'clamp(72px, 18vw, 128px)', height: 'clamp(72px, 18vw, 128px)' }}
              />
            </div>
            <div className="w-full max-w-[140px] sm:max-w-[160px] opacity-90 hidden sm:block">
              <TicketBarcode value={code} height={36} />
            </div>
            {isUsed && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(127,29,29,0.82)' }}>
                <div className="text-center px-2">
                  <p className="text-white font-extrabold text-sm sm:text-base">Already scanned</p>
                  {checkedInAt && (
                    <p className="text-red-100 text-[10px] sm:text-xs mt-1">{new Date(checkedInAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}
            {!isUsed && isExpired && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(55,65,81,0.85)' }}>
                <div className="text-center px-2">
                  <p className="text-white font-extrabold text-sm sm:text-base">Expired</p>
                  <p className="text-gray-200 text-[10px] sm:text-xs mt-1">Event has ended</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
'@
Write-ClaudeFile "components\EventTicket.tsx" $content

Write-Host "Writing: app\attendee\dashboard\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import ShareTicket from './ShareTicket';
import TransferTicketButton from './TransferTicketButton';

export const dynamic = 'force-dynamic';

function mapsUrl(lat: number, lng: number) {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}

export default async function AttendeeDashboard() {
  const session = await getSession();
  if (!session) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Please log in to view your dashboard.</div>;
  }

  const lowerEmail = session.email.toLowerCase();

  const [{ count: messageCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM messages WHERE recipient_id = ${session.userId}
  `;

  const orders = await sql`
    SELECT o.id, o.total_amount_kes, o.payment_status, o.created_at, o.quantity,
           e.title, e.venue_name, e.start_at, e.end_at, e.slug, e.cover_image_url,
           e.latitude, e.longitude,
           COALESCE(
             json_agg(json_build_object('code', t.ticket_code, 'status', t.status) ORDER BY t.ticket_code)
             FILTER (WHERE t.id IS NOT NULL),
             '[]'
           ) AS tickets
    FROM orders o
    JOIN events e ON e.id = o.event_id
    LEFT JOIN tickets t ON t.order_id = o.id
    WHERE o.buyer_email = ${lowerEmail}
    AND o.payment_status = 'paid'
    GROUP BY o.id, e.id
    ORDER BY o.created_at DESC
  `;

  // Events this attendee has been added as door staff for - grants them
  // access to the check-in scanner, separate from any tickets they hold.
  const staffEvents = await sql`
    SELECT e.id, e.title, e.venue_name, e.start_at, e.end_at, e.status
    FROM event_staff es
    JOIN events e ON e.id = es.event_id
    WHERE es.user_id = ${session.userId}
    ORDER BY e.start_at DESC
  `;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-3xl font-extrabold">My Tickets</h1>
        <Link
          href="/inbox"
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-2 text-sm font-semibold text-white transition shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Inbox
          {messageCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ minWidth: 20, textAlign: 'center' }}>
              {messageCount}
            </span>
          )}
        </Link>
      </div>
      <p className="text-gray-400 text-sm mb-6">{orders.length} paid order(s)</p>

      {staffEvents.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Door Staff Access</p>
          <ul className="space-y-2">
            {staffEvents.map((e: any) => {
              const ended =
                e.status === 'completed' ||
                (e.status !== 'cancelled' && (e.end_at ? new Date(e.end_at) : new Date(e.start_at)) < new Date());
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-white text-sm">{e.title}</p>
                    <p className="text-gray-500 text-xs">
                      {e.venue_name}
                      {e.start_at && ` · ${new Date(e.start_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}`}
                    </p>
                  </div>
                  {ended ? (
                    <span className="text-xs text-gray-500 whitespace-nowrap">Check-in closed</span>
                  ) : (
                    <Link
                      href={`/scan/${e.id}`}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap"
                    >
                      Scan Tickets
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {orders.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
          No tickets yet. <Link href="/" className="text-indigo-400 hover:text-cyan-400">Browse events</Link>
        </div>
      )}

      <ul className="space-y-5">
        {orders.map((o: any) => {
          const eventEnded = (o.end_at || o.start_at) ? new Date(o.end_at || o.start_at) < new Date() : false;
          return (
            <li key={o.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {o.cover_image_url && (
                <img src={o.cover_image_url} alt={o.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-5">
                <h2 className="text-lg font-bold text-white mb-1">{o.title}</h2>
                <p className="text-gray-400 text-sm mb-1">{o.venue_name}</p>
                <p className="text-indigo-400 font-semibold text-sm mb-4">
                  {new Date(o.start_at).toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' })}
                </p>

                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Your tickets ({o.tickets.length}):
                  </p>
                  <div className="flex flex-col gap-2">
                    {o.tickets.map((t: any, index: number) => (
                      <div key={t.code} className="flex flex-wrap items-center gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-500 min-w-[20px]">#{index + 1}</span>
                        <Link href={'/tickets/' + t.code} className="text-indigo-400 hover:text-cyan-400 font-semibold text-sm flex-1">
                          View Ticket
                        </Link>
                        {t.status === 'valid' && !eventEnded && (
                          <ShareTicket code={t.code} eventTitle={o.title} />
                        )}
                        {t.status === 'valid' && !eventEnded && (
                          <TransferTicketButton code={t.code} />
                        )}
                        {t.status === 'used' && (
                          <span className="text-xs text-gray-500 whitespace-nowrap">Checked in</span>
                        )}
                        {t.status === 'valid' && eventEnded && (
                          <span className="text-xs text-gray-500 whitespace-nowrap">Expired</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {o.latitude && o.longitude ? (
                  <a href={mapsUrl(o.latitude, o.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-semibold">
                    View on Google Maps
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">{o.venue_name}</p>
                )}

                <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-sm text-gray-400">
                  <span>KES {Number(o.total_amount_kes).toLocaleString()} &middot; {o.quantity} ticket(s)</span>
                  <span>{new Date(o.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
'@
Write-ClaudeFile "app\attendee\dashboard\page.tsx" $content

Write-Host "Writing: app\my-tickets\view\page.tsx" -ForegroundColor Cyan
$content = @'
﻿import { sql } from '@/lib/db';
import { verifyTicketsMagicLink } from '@/lib/auth';
import { getTicketDisplayStatus } from '@/lib/tickets';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MyTicketsViewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect('/my-tickets');

  const verified = await verifyTicketsMagicLink(token);
  if (!verified) {
    return (
      <main className="max-w-md mx-auto py-16 px-4 text-white text-center">
        <h1 className="text-xl font-bold text-red-400 mb-2">Link expired or invalid</h1>
        <p className="text-gray-400 text-sm mb-6">
          Magic links work for one hour. Request a new one with the same email.
        </p>
        <Link
          href="/my-tickets"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
        >
          Request new link
        </Link>
      </main>
    );
  }

  const email = verified.email;

  const orders = await sql`
    SELECT
      o.id,
      o.quantity,
      o.total_amount_kes,
      o.created_at,
      o.payment_status,
      e.title AS event_title,
      e.venue_name,
      e.start_at,
      e.end_at,
      e.status AS event_status,
      e.slug
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE LOWER(o.buyer_email) = ${email}
      AND o.payment_status = 'paid'
    ORDER BY o.created_at DESC
  `;

  const orderIds = orders.map((o) => o.id as string);
  let tickets: Record<string, unknown>[] = [];
  if (orderIds.length > 0) {
    tickets = await sql`
      SELECT t.ticket_code, t.status, t.holder_name, t.order_id, tt.name AS ticket_type
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.order_id = ANY(${orderIds})
      ORDER BY t.ticket_code ASC
    `;
  }

  const ticketsByOrder = new Map<string, typeof tickets>();
  for (const t of tickets) {
    const oid = t.order_id as string;
    if (!ticketsByOrder.has(oid)) ticketsByOrder.set(oid, []);
    ticketsByOrder.get(oid)!.push(t);
  }

  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-white">
      <h1 className="text-2xl font-extrabold mb-1">Your tickets</h1>
      <p className="text-gray-400 text-sm mb-6">
        Showing paid orders for <span className="text-indigo-300">{email}</span>
      </p>

      {orders.length === 0 ? (
        <p className="text-gray-500">No paid tickets found for this email.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const list = ticketsByOrder.get(o.id as string) || [];
            return (
              <li key={o.id as string} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <h2 className="font-bold text-lg">{o.event_title as string}</h2>
                    <p className="text-xs text-gray-500">
                      {o.venue_name ? `${o.venue_name} · ` : ''}
                      {o.start_at ? new Date(o.start_at as string).toLocaleString('en-KE') : ''}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-emerald-400 font-semibold">
                      KES {Number(o.total_amount_kes).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {Number(o.quantity)} ticket{Number(o.quantity) === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                {list.length === 0 ? (
                  <p className="text-amber-400/90 text-sm">Tickets are still being issued…</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((t) => {
                      const displayStatus = getTicketDisplayStatus(t.status as string, {
                        status: o.event_status as string,
                        start_at: o.start_at as string,
                        end_at: o.end_at as string,
                      });
                      return (
                      <li
                        key={t.ticket_code as string}
                        className="flex justify-between items-center bg-gray-950/80 border border-gray-800 rounded-xl px-3 py-2.5"
                      >
                        <div>
                          <span className="font-mono text-sm text-indigo-300">
                            {t.ticket_code as string}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {(t.ticket_type as string) || 'Ticket'}
                            {t.holder_name ? ` · ${t.holder_name}` : ''}
                          </span>
                          {displayStatus === 'used' && (
                            <span className="ml-2 text-xs text-red-400">Used</span>
                          )}
                          {displayStatus === 'expired' && (
                            <span className="ml-2 text-xs text-gray-500">Expired</span>
                          )}
                        </div>
                        <Link
                          href={`/tickets/${t.ticket_code}`}
                          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg"
                        >
                          Open QR
                        </Link>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-gray-600 mt-8 text-center">
        This page was opened with a private link. Do not share it. Request a new link anytime at{' '}
        <Link href="/my-tickets" className="text-indigo-400">
          /my-tickets
        </Link>
        .
      </p>
    </main>
  );
}
'@
Write-ClaudeFile "app\my-tickets\view\page.tsx" $content

Write-Host ""
Write-Host "Done. Files updated:" -ForegroundColor Green
Write-Host "  - lib\tickets.ts (new getTicketDisplayStatus helper)"
Write-Host "  - app\tickets\[code]\page.tsx"
Write-Host "  - components\EventTicket.tsx"
Write-Host "  - app\attendee\dashboard\page.tsx"
Write-Host "  - app\my-tickets\view\page.tsx"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git add -A"
Write-Host "  git commit -m \"Show expired status for unscanned tickets on ended events\""
Write-Host "  git push"

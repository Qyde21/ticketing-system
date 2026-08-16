# Run this from your project root: C:\Users\user\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File fix-messaging-and-staff-access.ps1
#
# This pass fixes:
# 1. Corrupted characters (mojibake) in contact-form and message-notification
#    email subject lines, plus one in the organizer dashboard's unlimited-
#    capacity display.
# 2. HTML-escapes user-supplied text (name, message body, etc.) before it's
#    interpolated into emails, closing an HTML-injection gap in the contact
#    form and messaging notification emails.
# 3. Adds a "Door Staff Access" section to the attendee dashboard, linking
#    to the scan page for any event the attendee has been added as staff
#    for — this was completely missing before, so staff had no way to find
#    the scanner even though the backend already supported their access.

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


Write-Host "Writing: app\api\contact\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResend() { if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set"); return new Resend(process.env.RESEND_API_KEY); }

// Escapes user-supplied text before it's interpolated into an HTML email —
// these fields are attacker-controlled input, so without this a submitted
// name/message could inject markup or deceptive links into the email your
// support inbox (and the sender's own auto-reply) renders.
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    await getResend().emails.send({
      from: 'TicketHub <noreply@mytickethub.co.ke>',
      to: 'support@mytickethub.co.ke',
      replyTo: email,
      subject: 'Contact Form: ' + subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>New contact form submission</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #374151;">${safeMessage}</blockquote>
        </div>
      `,
    });

    await getResend().emails.send({
      from: 'TicketHub <noreply@mytickethub.co.ke>',
      to: email,
      subject: 'We received your message - TicketHub',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Thanks for reaching out, ${safeName}!</h2>
          <p>We received your message about <strong>${safeSubject}</strong> and will get back to you within 24 hours.</p>
          <p>In the meantime, you can also reach us instantly on WhatsApp: <a href="https://wa.me/254114525941">+254 114 525 941</a></p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">Sent by TicketHub</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

'@
Write-ClaudeFile "app\api\contact\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\contact\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\messages\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Resend } from 'resend';

function getResend() { if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set"); return new Resend(process.env.RESEND_API_KEY); }

// Escapes text before it's interpolated into an HTML email — message body,
// names, and event titles are all ultimately user-supplied, so without this
// a message could inject markup or deceptive links into the recipient's
// notification email.
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { eventId, recipientId, body, isBroadcast } = await req.json();

  if (!eventId || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const [event] = await sql`SELECT id, title, organizer_id FROM events WHERE id = ${eventId}`;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const isOrganizer = session.userId === event.organizer_id || session.role === 'admin';

  if (isBroadcast && !isOrganizer) {
    return NextResponse.json({ error: 'Only organizers can send broadcast messages' }, { status: 403 });
  }

  if (isBroadcast) {
    const buyers = await sql`
      SELECT DISTINCT u.id, u.email, u.full_name
      FROM orders o
      JOIN users u ON u.email = o.buyer_email
      WHERE o.event_id = ${eventId} AND o.payment_status = 'paid'
    `;

    for (const buyer of buyers) {
      await sql`
        INSERT INTO messages (event_id, sender_id, recipient_id, body, is_broadcast)
        VALUES (${eventId}, ${session.userId}, ${buyer.id}, ${body}, true)
      `;

      try {
        await getResend().emails.send({
          from: 'TicketHub <noreply@mytickethub.co.ke>',
          to: buyer.email,
          subject: `Message from organizer - ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>Message about ${escapeHtml(event.title)}</h2>
              <p>Hi ${escapeHtml(buyer.full_name)},</p>
              <p>${escapeHtml(body)}</p>
              <p style="color: #888; font-size: 12px; margin-top: 24px;">
                You can reply to this message by visiting your TicketHub inbox.
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.error('Failed to send email to', buyer.email, err);
      }
    }

    return NextResponse.json({ success: true, sent: buyers.length });
  }

  if (!recipientId) {
    return NextResponse.json({ error: 'Recipient required for direct messages' }, { status: 400 });
  }

  if (isOrganizer) {
    // Organizer/admin can only message actual paid buyers of this event.
    const [buyerMatch] = await sql`
      SELECT 1 FROM orders o
      JOIN users u ON u.email = o.buyer_email
      WHERE o.event_id = ${eventId} AND o.payment_status = 'paid' AND u.id = ${recipientId}
      LIMIT 1
    `;
    if (!buyerMatch) {
      return NextResponse.json({ error: 'Recipient is not a buyer of this event' }, { status: 403 });
    }
  } else {
    // Sender must be a paid buyer of this event, and can only message its organizer or an admin.
    const senderEmail = session.email.toLowerCase();
    const [buyerCheck] = await sql`
      SELECT 1 FROM orders
      WHERE event_id = ${eventId} AND payment_status = 'paid' AND LOWER(buyer_email) = ${senderEmail}
      LIMIT 1
    `;
    if (!buyerCheck) {
      return NextResponse.json({ error: 'You are not authorized to message about this event' }, { status: 403 });
    }

    const [recipientUser] = await sql`SELECT id, role FROM users WHERE id = ${recipientId}`;
    const recipientIsOrganizerOrAdmin = !!recipientUser && (recipientId === event.organizer_id || recipientUser.role === 'admin');
    if (!recipientIsOrganizerOrAdmin) {
      return NextResponse.json({ error: 'You can only message the event organizer' }, { status: 403 });
    }
  }

  await sql`
    INSERT INTO messages (event_id, sender_id, recipient_id, body, is_broadcast)
    VALUES (${eventId}, ${session.userId}, ${recipientId}, ${body}, false)
  `;

  const [recipient] = await sql`SELECT email, full_name FROM users WHERE id = ${recipientId}`;
  const [sender] = await sql`SELECT full_name FROM users WHERE id = ${session.userId}`;

  try {
    await getResend().emails.send({
      from: 'TicketHub <noreply@mytickethub.co.ke>',
      to: recipient.email,
      subject: `New message about ${event.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>New message about ${escapeHtml(event.title)}</h2>
          <p>Hi ${escapeHtml(recipient.full_name)},</p>
          <p><strong>${escapeHtml(sender.full_name)}</strong> sent you a message:</p>
          <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #374151;">${escapeHtml(body)}</blockquote>
          <p>Log in to TicketHub to reply.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send message email:', err);
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');

  if (eventId) {
    const messages = await sql`
      SELECT m.id, m.body, m.is_broadcast, m.created_at,
             u.full_name AS sender_name, u.id AS sender_id,
             r.full_name AS recipient_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN users r ON r.id = m.recipient_id
      WHERE m.event_id = ${eventId}
      AND (m.sender_id = ${session.userId} OR m.recipient_id = ${session.userId} OR m.is_broadcast = true)
      ORDER BY m.created_at ASC
    `;
    return NextResponse.json({ messages });
  }

  const messages = await sql`
    SELECT m.id, m.body, m.is_broadcast, m.created_at, m.event_id,
           u.full_name AS sender_name, u.id AS sender_id,
           e.title AS event_title
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    JOIN events e ON e.id = m.event_id
    WHERE m.recipient_id = ${session.userId}
    ORDER BY m.created_at DESC
  `;

  return NextResponse.json({ messages });
}

'@
Write-ClaudeFile "app\api\messages\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\messages\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\organizer\dashboard\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PublishButton from '../PublishButton';
import CancelEventButton from '../CancelEventButton';

export const dynamic = 'force-dynamic';

export default async function OrganizerDashboardPage() {
  const session = await getSession();

  if (!session) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized.</div>;
  }

  // Fetch events belonging to this organizer (or all if admin)
  const events = session.role === 'admin' 
    ? await sql`SELECT * FROM events ORDER BY created_at DESC`
    : await sql`SELECT * FROM events WHERE organizer_id = ${session.userId} ORDER BY created_at DESC`;

  // Organizers must be approved by an admin before they can create events,
  // and a suspension should immediately block creation too â€” checked live
  // from the DB rather than trusting the session cookie's role/state alone.
  let isVerifiedOrganizer = true;
  let isSuspended = false;
  if (session.role === 'organizer') {
    const [account] = await sql`
      SELECT u.status, COALESCE(op.is_verified, false) AS is_verified
      FROM users u
      LEFT JOIN organizer_profiles op ON op.user_id = u.id
      WHERE u.id = ${session.userId}
    `;
    isVerifiedOrganizer = account?.is_verified === true;
    isSuspended = account?.status === 'suspended';
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Events & Ticket Inventory Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time status breakdown and ticket sales overview</p>
        </div>
        {isSuspended ? (
          <span
            className="bg-red-950/60 border border-red-800 text-red-300 font-medium px-4 py-2 rounded-lg text-sm"
            title="Your account has been suspended"
          >
            â›” Account suspended
          </span>
        ) : isVerifiedOrganizer ? (
          <Link
            href="/organizer/events/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow text-sm"
          >
            + Create Event
          </Link>
        ) : (
          <span
            className="flash-sale-badge bg-amber-950/60 border border-amber-700 text-amber-300 font-medium px-4 py-2 rounded-lg text-sm"
            title="An admin needs to approve your organizer account before you can create events"
          >
            â³ Pending admin approval
          </span>
        )}
      </div>

      {isSuspended && (
        <div className="mb-8 p-4 bg-red-950/40 border border-red-800 rounded-lg text-red-200 text-sm">
          Your organizer account has been suspended. You cannot create new events while suspended. Contact support if you believe this is a mistake.
        </div>
      )}

      {!isSuspended && !isVerifiedOrganizer && (
        <div className="flash-sale-badge mb-8 p-4 bg-amber-950/40 border border-amber-800 rounded-lg text-amber-200 text-sm">
          Your organizer account is awaiting approval from a TicketHub admin. Once approved, you&apos;ll be able to create and publish events. This usually doesn&apos;t take long â€” check back soon.
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No events found.
        </div>
      ) : (
        <div className="space-y-6">
          {events.map(async (event: any) => {
            // Fetch ticket types and orders for revenue/tickets sold breakdown
            const ticketTypes = await sql`
              SELECT * FROM ticket_types WHERE event_id = ${event.id}
            `;
            
            const orders = await sql`
              SELECT quantity, total_amount_kes, payment_status, ticket_type_id 
              FROM orders 
              WHERE event_id = ${event.id} AND (payment_status = 'paid' OR payment_status = 'completed' OR payment_status = 'success')
            `;

            const totalRevenue = orders.reduce((acc: number, o: any) => acc + Number(o.total_amount_kes), 0);
            const totalTicketsSold = orders.reduce((acc: number, o: any) => acc + Number(o.quantity), 0);
            const totalInventory = ticketTypes.reduce((acc: number, t: any) => acc + Number(t.quantity_total), 0);

            const eventEnded = (event.end_at ? new Date(event.end_at) : new Date(event.start_at)) < new Date();


            return (
              <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{event.title}</h2>
                      {(() => {
                        const eventEnded =
                          event.status !== 'cancelled' &&
                          (event.end_at ? new Date(event.end_at) : new Date(event.start_at)) < new Date();
                        const isCompleted = event.status === 'completed' || eventEnded;
                        if (isCompleted) {
                          return (
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-gray-800 text-gray-300 border border-gray-600">
                              Completed
                            </span>
                          );
                        }
                        return (
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                            event.status === 'published' ? 'bg-green-950 text-green-400 border border-green-800'
                            : event.status === 'pending_review' ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : event.status === 'cancelled' ? 'bg-red-950 text-red-400 border border-red-800'
                            : 'bg-gray-800 text-gray-400'
                          }`}>
                            {event.status === 'pending_review' ? 'Pending Review' : event.status}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Created: {new Date(event.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <span className="text-xs text-gray-400 block">Revenue</span>
                      <span className="text-lg font-extrabold text-cyan-400">KES {totalRevenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Tickets Sold</span>
                      <span className="text-lg font-extrabold text-emerald-400">{totalTicketsSold} / {totalInventory || '∞'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-indigo-400 pt-1">
                  <Link href={`/organizer/events/${event.id}/orders`} className="hover:underline text-cyan-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Orders</Link>
                  <Link href={`/organizer/events/${event.id}/analytics`} className="hover:underline text-cyan-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Analytics</Link>
{eventEnded ? (
                    <span className="text-gray-600 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800 cursor-not-allowed" title="Flash sales are disabled after the event has ended">Flash Sales</span>
                  ) : (
                    <Link href={`/organizer/events/${event.id}/flash-sales`} className="hover:underline text-amber-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Flash Sales</Link>
                  )}
                  <Link href={`/organizer/events/${event.id}/edit`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Manage Details</Link>
                  <Link href={`/organizer/events/${event.id}/messages`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Messages</Link>
                  <Link href={`/organizer/events/${event.id}/scan-overview`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Scan Overview</Link>
                  {eventEnded ? (
                    <span className="text-gray-600 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800 cursor-not-allowed" title="Promo codes are disabled after the event has ended">Promo Codes</span>
                  ) : (
                    <Link href={`/organizer/events/${event.id}/promo-codes`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Promo Codes</Link>
                  )}
                  <Link href={`/organizer/events/new?duplicateFrom=${event.id}`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Duplicate</Link>
                  {event.status === 'draft' && (
                    <PublishButton eventId={event.id} />
                  )}
                  {event.status === 'pending_review' && (
                    <span className="flash-sale-badge bg-amber-950/50 text-amber-300 border border-amber-800/50 px-3 py-1.5 rounded-lg font-semibold">
                      Awaiting Admin Review
                    </span>
                  )}
                  {event.status !== 'cancelled' && (
                    <CancelEventButton eventId={event.id} />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {ticketTypes.map((ticket: any) => {
                    const sold = orders
                      .filter((o: any) => o.ticket_type_id === ticket.id)
                      .reduce((acc: number, o: any) => acc + Number(o.quantity), 0);
                    const remaining = ticket.quantity_total - sold;
                    const progress = Math.min(100, (sold / ticket.quantity_total) * 100);

                    return (
                      <div key={ticket.id} className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-white text-sm">{ticket.name}</h3>
                          <span className="text-indigo-300 font-bold text-sm">KES {Number(ticket.price_kes).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Sold: <strong className="text-white">{sold}</strong></span>
                          <span>Remaining: <strong className={remaining <= 0 ? 'text-red-500 font-extrabold' : 'text-white'}>{remaining}</strong></span>
                          <span>Total: <strong className="text-white">{ticket.quantity_total}</strong></span>
                        </div>
                        {remaining <= 0 && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/50 border border-red-800 rounded px-2 py-0.5">
                            Sold Out
                          </span>
                        )}
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
'@
Write-ClaudeFile "app\organizer\dashboard\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\organizer\dashboard\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

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

  // Events this attendee has been added as door staff for — grants them
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
if (-not (Test-Path -LiteralPath "app\attendee\dashboard\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}


Write-Host ""
if ($script:anyFailed) {
    Write-Host "SOME FILES FAILED TO WRITE - do not push yet, share this output." -ForegroundColor Red
} else {
    Write-Host "All files confirmed written successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Fix mojibake + HTML-escape emails, add staff scan access to attendee dashboard"""
    Write-Host "  git push origin main"
}

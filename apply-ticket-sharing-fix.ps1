# Run this from your project root: C:\Users\user\Desktop\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File apply-ticket-sharing-fix.ps1
#
# Makes both "Share" and "Transfer" remove a ticket from the buyer's own
# "My Tickets" list once they've given it away - previously only Transfer
# changed who holds the ticket, and even then the buyer's dashboard kept
# showing it because that list is built from the ORDER, not the current
# ticket holder.
#
#   - New migration: adds tickets.shared_at (nullable timestamp)
#   - New API route: POST /api/tickets/[code]/share - marks a ticket as
#     shared (owner or admin only, blocked once used/cancelled)
#   - ShareTicket.tsx now calls that route when either "Copy link" or the
#     WhatsApp "Share" button is used, then shows "Shared" in place of the
#     buttons
#   - TransferTicketButton.tsx now refreshes the list after a successful
#     transfer, so the ticket disappears immediately instead of only on
#     next page load
#   - attendee/dashboard and my-tickets/view both now exclude tickets that
#     are shared_at-marked OR whose holder_email no longer matches the
#     buyer (i.e. transferred away)
#
# IMPORTANT: run your migration against the database too - this script
# only touches files. From your project root, with DATABASE_URL/
# POSTGRES_URL set, run whatever you normally use to apply
# migrations/007_ticket_shared_at.sql (e.g. psql, or your existing
# migration runner).

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-ClaudeFile($path, $content) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

Write-Host "Writing: migrations\007_ticket_shared_at.sql" -ForegroundColor Cyan
$content = @'
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;
'@
Write-ClaudeFile "migrations\007_ticket_shared_at.sql" $content

Write-Host "Writing: schema.sql" -ForegroundColor Cyan
$content = @'
-- Ticketing System â€” database schema
--
-- NOTE: This file was reconstructed by reading every query in the codebase,
-- since no migrations/schema file was committed to the repo and the app
-- connects directly to an existing Neon Postgres database. It should closely
-- match production, but for a source of truth, run against the real database:
--
--   pg_dump --schema-only $DATABASE_URL_UNPOOLED > schema.sql
--
-- Use this file to set up a fresh local/dev database when a pg_dump isn't
-- available.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT, -- nullable: OAuth-only accounts (Google, later Apple) have no password
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'attendee', -- 'attendee' | 'organizer' | 'admin'
  status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
  email_verified BOOLEAN NOT NULL DEFAULT false,
  totp_secret   TEXT, -- base32 TOTP secret, only set once 2FA setup begins
  totp_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Links a user to one or more OAuth identity providers. Designed to support
-- multiple providers per user (e.g. Google now, Apple later) without further
-- schema changes â€” provider + provider_user_id together are unique.
CREATE TABLE oauth_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL, -- 'google' | 'apple'
  provider_user_id TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

-- Email verification tokens, sent on signup. Mirrors password_reset_tokens below.
CREATE TABLE email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-use backup codes for account recovery if the authenticator device is lost.
-- Codes are stored as SHA-256 hashes, never in plain text.
CREATE TABLE totp_backup_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizer_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT,
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id     UUID NOT NULL REFERENCES users(id),
  title            TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  description      TEXT,
  category         TEXT,
  venue_name       TEXT,
  venue_address    TEXT,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'cancelled', 'completed')),
  cover_image_url  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_staff (
  event_id  UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE ticket_types (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  price_kes      NUMERIC NOT NULL,
  quantity_total INTEGER NOT NULL,
  quantity_sold  INTEGER NOT NULL DEFAULT 0,
  max_per_order  INTEGER NOT NULL DEFAULT 10,
  flash_sale_price_kes     NUMERIC,
  flash_sale_starts_at     TIMESTAMPTZ,
  flash_sale_ends_at       TIMESTAMPTZ,
  flash_sale_quantity_cap  INTEGER,
  flash_sale_quantity_sold INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE waitlist_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  notified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_type_id, email)
);

CREATE TABLE promo_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code           TEXT NOT NULL,
  discount_type  TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  discount_value NUMERIC NOT NULL,
  max_uses       INTEGER, -- NULL means unlimited
  uses_count     INTEGER NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ, -- NULL means never expires
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, code)
);

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES events(id),
  ticket_type_id      UUID NOT NULL REFERENCES ticket_types(id),
  buyer_name          TEXT NOT NULL,
  buyer_email         TEXT NOT NULL,
  buyer_phone         TEXT NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1,
  total_amount_kes    NUMERIC NOT NULL,
  promo_code_id       UUID REFERENCES promo_codes(id),
  discount_amount_kes NUMERIC NOT NULL DEFAULT 0,
  payment_status      TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'expired')),
  paystack_reference  TEXT UNIQUE,
  is_flash_sale       BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  ticket_code    TEXT UNIQUE NOT NULL,
  holder_name    TEXT,
  holder_email   TEXT,
  status         TEXT NOT NULL DEFAULT 'valid', -- 'valid' | 'used' | 'cancelled'
  checked_in_at  TIMESTAMPTZ,
  checked_in_by  UUID REFERENCES users(id),
  shared_at      TIMESTAMPTZ -- set when the buyer shares this ticket's link; hides it from the buyer's own "My Tickets" list, same as a transfer
);

CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES users(id),
  recipient_id  UUID REFERENCES users(id), -- null for broadcast messages
  body          TEXT NOT NULL,
  is_broadcast  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Referenced by app/api/events/[id]/delete/route.ts; not otherwise inserted
-- into anywhere in the current codebase (likely written by the Paystack
-- webhook handler in an earlier version, or reserved for future use).
CREATE TABLE payment_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracks failed login attempts for rate limiting (by email and by IP).
-- Rows older than 1 hour are cleaned up automatically on each login request.
-- Tracks failed login attempts and other rate-limited requests (e.g. password
-- reset requests), scoped by `type` so different endpoints don't share a
-- counter. Rows older than 1 hour are cleaned up automatically on each request.
CREATE TABLE login_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL DEFAULT 'login', -- 'login' | 'forgot_password'
  email      TEXT NOT NULL,
  ip         TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores hashed, single-use password reset tokens. The raw token is only
-- ever emailed to the user; only its SHA-256 hash is stored here.
CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_email_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_email_otps_user_created_idx
  ON login_email_otps (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  gate          TEXT,
  slots_needed  INTEGER NOT NULL DEFAULT 1 CHECK (slots_needed >= 1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_shifts_time_check CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS event_shift_assignments (
  shift_id   UUID NOT NULL REFERENCES event_shifts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'assigned'
             CHECK (status IN ('assigned', 'confirmed', 'no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_id, user_id)
);
'@
Write-ClaudeFile "schema.sql" $content

Write-Host "Writing: app\api\tickets\[code]\share\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Marking a ticket as "shared" doesn't change who holds it (unlike a
// transfer) - the buyer just gave someone else the link/QR. But once
// they've done that, we no longer want it cluttering the buyer's own
// "My Tickets" list, same as a transfer would. This just records that
// it happened; app/attendee/dashboard and app/my-tickets/view both
// filter out tickets with shared_at set.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'You must be logged in to share a ticket' }, { status: 401 });
  }

  const { code } = await params;

  try {
    const [ticket] = await sql`
      SELECT t.id, t.status, t.shared_at, o.buyer_email,
             e.start_at, e.end_at
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      JOIN events e ON e.id = o.event_id
      WHERE t.ticket_code = ${code}
    `;

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isOwner = ticket.buyer_email.toLowerCase() === session.email.toLowerCase();
    if (!isOwner && session.role !== 'admin') {
      return NextResponse.json({ error: 'You are not authorized to share this ticket' }, { status: 403 });
    }

    if (ticket.status === 'used') {
      return NextResponse.json({ error: 'This ticket has already been checked in' }, { status: 400 });
    }
    if (ticket.status === 'cancelled') {
      return NextResponse.json({ error: 'This ticket has been cancelled' }, { status: 400 });
    }

    if (!ticket.shared_at) {
      await sql`UPDATE tickets SET shared_at = NOW() WHERE id = ${ticket.id}`;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Ticket share error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
'@
Write-ClaudeFile "app\api\tickets\[code]\share\route.ts" $content

Write-Host "Writing: app\attendee\dashboard\ShareTicket.tsx" -ForegroundColor Cyan
$content = @'
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ShareTicket({ code, eventTitle }: { code: string; eventTitle: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [marking, setMarking] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ticketUrl = origin + '/tickets/' + code;
  const waMessage = 'Here is your ticket for ' + eventTitle + ': ' + ticketUrl;
  const waHref = 'https://wa.me/?text=' + encodeURIComponent(waMessage);

  // Once the buyer has actually shared it (via either button), mark it
  // server-side so it drops off their own "My Tickets" list - same as a
  // transfer would. Refresh so the list updates without a full reload.
  async function markShared() {
    if (marking) return;
    setMarking(true);
    try {
      await fetch(`/api/tickets/${code}/share`, { method: 'POST' });
      setShared(true);
      router.refresh();
    } catch {
      // Non-fatal: the link was already copied/opened either way. It'll
      // just still show in their list until they try sharing again.
    } finally {
      setMarking(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(ticketUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    markShared();
  }

  if (shared) {
    return <span className="text-xs text-gray-500 whitespace-nowrap">Shared</span>;
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={handleCopy}
        className={`text-xs px-2 py-1 rounded border whitespace-nowrap transition ${
          copied
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
        }`}
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={markShared}
        className="text-xs px-2 py-1 rounded border border-emerald-600 bg-emerald-600 text-white whitespace-nowrap hover:bg-emerald-500 transition"
      >
        Share
      </a>
    </div>
  );
}
'@
Write-ClaudeFile "app\attendee\dashboard\ShareTicket.tsx" $content

Write-Host "Writing: app\attendee\dashboard\TransferTicketButton.tsx" -ForegroundColor Cyan
$content = @'
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TransferTicketButton({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleTransfer() {
    if (!name.trim() || !email.trim()) {
      setError('Please enter a name and email');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/tickets/${code}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newHolderName: name, newHolderEmail: email }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(data.error || 'Failed to transfer ticket');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <span className="text-xs text-emerald-400 font-semibold whitespace-nowrap">Transferred!</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 whitespace-nowrap transition"
      >
        Transfer
      </button>
    );
  }

  return (
    <div className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 mt-2 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-300">Transfer this ticket to:</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipient's full name"
        className="w-full bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Recipient's email"
        className="w-full bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleTransfer}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition"
        >
          {loading ? 'Transferring...' : 'Confirm Transfer'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(''); }}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-md transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
'@
Write-ClaudeFile "app\attendee\dashboard\TransferTicketButton.tsx" $content

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
             FILTER (
               WHERE t.id IS NOT NULL
                 AND t.shared_at IS NULL
                 AND (t.holder_email IS NULL OR LOWER(t.holder_email) = LOWER(o.buyer_email))
             ),
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
                  {o.tickets.length === 0 ? (
                    <p className="text-gray-500 text-sm bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
                      All tickets from this order have been shared or transferred.
                    </p>
                  ) : (
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
                  )}
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
import { sql } from '@/lib/db';
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
      JOIN orders o ON o.id = t.order_id
      WHERE t.order_id = ANY(${orderIds})
        AND t.shared_at IS NULL
        AND (t.holder_email IS NULL OR LOWER(t.holder_email) = LOWER(o.buyer_email))
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
                  <p className="text-gray-500 text-sm">
                    No tickets to show here - they may still be issuing, or have already been shared or transferred.
                  </p>
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
Write-Host "  - migrations\007_ticket_shared_at.sql (NEW - remember to run this against your DB)"
Write-Host "  - schema.sql"
Write-Host "  - app\api\tickets\[code]\share\route.ts (NEW)"
Write-Host "  - app\attendee\dashboard\ShareTicket.tsx"
Write-Host "  - app\attendee\dashboard\TransferTicketButton.tsx"
Write-Host "  - app\attendee\dashboard\page.tsx"
Write-Host "  - app\my-tickets\view\page.tsx"
Write-Host ""
Write-Host "Don't forget to run migrations/007_ticket_shared_at.sql against your database." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git add -A"
Write-Host "  git commit -m ""Hide shared/transferred tickets from the buyer's own ticket list"""
Write-Host "  git push --force"

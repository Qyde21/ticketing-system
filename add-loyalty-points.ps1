# Run this from your project root: C:\Users\user\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File add-loyalty-points.ps1
#
# Feature 4/6: Loyalty / repeat-buyer perks
#
# Attendees earn 1 point per KES 100 spent (awarded automatically when an
# order is finalized as paid - same place ticket emails/SMS already get
# sent, non-blocking so a loyalty failure never stops ticket issuance).
# They can redeem points (min 100, 1 point = KES 1 off) toward any upcoming
# published event from a new panel on their dashboard. Redemption does NOT
# touch the checkout/payment flow directly - it generates a real, single-
# use promo code through the existing promo-codes system, which they then
# apply at checkout like any other code. This keeps the higher-risk
# checkout code completely untouched.
#
# Also includes a lightweight tier badge (Bronze/Silver/Gold, based on
# lifetime points earned) shown next to their balance.
#
# Like the favorites feature, the loyalty_transactions table self-heals -
# if it doesn't exist yet when first used, the code creates it on the fly.
# No manual migration step is required.
#
#   - New: migrations/009_loyalty_points.sql
#   - Updated: schema.sql
#   - New: lib/loyalty.ts (all points/tier/redemption logic)
#   - Updated: lib/tickets.ts (awards points on paid orders)
#   - New: app/api/loyalty/route.ts (GET balance)
#   - New: app/api/loyalty/redeem/route.ts (POST redeem)
#   - Updated: app/attendee/dashboard/page.tsx (renders the panel)
#   - New: app/attendee/dashboard/LoyaltyPanel.tsx

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-ClaudeFile($path, $content) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

Write-Host "Writing: migrations\009_loyalty_points.sql" -ForegroundColor Cyan
$content = @'
-- Loyalty points ledger. Keyed by (lowercased) buyer email, same as how
-- ticket/order ownership is matched everywhere else in this app - orders
-- have no user_id, only buyer_email, so this stays consistent with that.
-- Balance and lifetime-earned are both derived from this table (SUM of
-- points, and SUM of positive points respectively) rather than stored as
-- columns, so there's never a sync bug between a running total and reality.
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  order_id   UUID REFERENCES orders(id),
  points     INTEGER NOT NULL, -- positive = earned, negative = redeemed
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_email ON loyalty_transactions(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order_id ON loyalty_transactions(order_id);
'@
Write-ClaudeFile "migrations\009_loyalty_points.sql" $content

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

-- Loyalty points ledger, keyed by (lowercased) buyer email - see
-- migrations/009_loyalty_points.sql for the full explanation.
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  order_id   UUID REFERENCES orders(id),
  points     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
'@
Write-ClaudeFile "schema.sql" $content

Write-Host "Writing: lib\loyalty.ts" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';

// Tunable constants - change these to adjust the whole program's economics
// without touching any call sites.
export const KES_PER_POINT_EARNED = 100; // 1 point per KES 100 spent
export const KES_PER_POINT_REDEEMED = 1; // 1 point = KES 1 off at checkout
export const MIN_REDEMPTION_POINTS = 100; // smallest redemption allowed
export const REDEEMED_CODE_EXPIRY_DAYS = 30;

export const LOYALTY_TIERS = [
  { name: 'Gold', minPoints: 2000 },
  { name: 'Silver', minPoints: 500 },
  { name: 'Bronze', minPoints: 0 },
] as const;

export type LoyaltyTierName = (typeof LOYALTY_TIERS)[number]['name'];

export function tierForLifetimePoints(lifetimePoints: number): LoyaltyTierName {
  for (const tier of LOYALTY_TIERS) {
    if (lifetimePoints >= tier.minPoints) return tier.name;
  }
  return 'Bronze';
}

async function ensureLoyaltyTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT NOT NULL,
      order_id   UUID REFERENCES orders(id),
      points     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_email ON loyalty_transactions(LOWER(email))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order_id ON loyalty_transactions(order_id)`;
}

function isMissingTableError(msg: string) {
  const m = msg.toLowerCase();
  return m.includes('loyalty_transactions') && (m.includes('does not exist') || m.includes('undefined_table'));
}

async function withTableEnsured<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (isMissingTableError(msg)) {
      await ensureLoyaltyTable();
      return await fn();
    }
    throw err;
  }
}

export interface LoyaltySummary {
  balance: number;
  lifetimeEarned: number;
  tier: LoyaltyTierName;
}

export async function getLoyaltySummary(email: string): Promise<LoyaltySummary> {
  const normalized = email.trim().toLowerCase();

  return withTableEnsured(async () => {
    const [row] = await sql`
      SELECT
        COALESCE(SUM(points), 0) AS balance,
        COALESCE(SUM(points) FILTER (WHERE points > 0), 0) AS lifetime_earned
      FROM loyalty_transactions
      WHERE LOWER(email) = ${normalized}
    `;
    const balance = Number(row?.balance || 0);
    const lifetimeEarned = Number(row?.lifetime_earned || 0);
    return { balance, lifetimeEarned, tier: tierForLifetimePoints(lifetimeEarned) };
  });
}

/**
 * Awards points for a paid order. Idempotent - safe to call more than once
 * for the same order (e.g. if finalizePaidOrder is retried), since it
 * checks for an existing 'earned' transaction for that order_id first.
 * Never throws - a loyalty-points failure should never block ticket
 * issuance, so callers can fire-and-forget this.
 */
export async function awardPointsForOrder(orderId: string, email: string, amountKes: number): Promise<void> {
  try {
    await withTableEnsured(async () => {
      const [existing] = await sql`
        SELECT id FROM loyalty_transactions WHERE order_id = ${orderId} AND reason = 'earned'
      `;
      if (existing) return;

      const points = Math.floor(Number(amountKes || 0) / KES_PER_POINT_EARNED);
      if (points <= 0) return;

      await sql`
        INSERT INTO loyalty_transactions (email, order_id, points, reason)
        VALUES (${email.trim().toLowerCase()}, ${orderId}, ${points}, 'earned')
      `;
    });
  } catch (err) {
    console.error('awardPointsForOrder failed (non-fatal):', err);
  }
}

export interface RedeemResult {
  success: boolean;
  error?: string;
  code?: string;
  discountKes?: number;
}

/**
 * Redeems points into a real, single-use promo code scoped to one event -
 * reuses the platform's existing, already-tested promo-code discount logic
 * at checkout instead of the redemption flow having to touch checkout/
 * payment code directly.
 */
export async function redeemPointsForEvent(
  email: string,
  eventId: string,
  points: number
): Promise<RedeemResult> {
  const normalized = email.trim().toLowerCase();

  if (!Number.isFinite(points) || points < MIN_REDEMPTION_POINTS) {
    return { success: false, error: `Minimum redemption is ${MIN_REDEMPTION_POINTS} points` };
  }

  return withTableEnsured(async () => {
    const { balance } = await getLoyaltySummary(normalized);
    if (points > balance) {
      return { success: false, error: 'You do not have enough points for that' };
    }

    const [event] = await sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`;
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    const discountKes = points * KES_PER_POINT_REDEEMED;
    const code = 'LOYALTY-' + nanoid(8).toUpperCase();
    const expiresAt = new Date(Date.now() + REDEEMED_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO promo_codes (event_id, code, discount_type, discount_value, max_uses, expires_at, active)
      VALUES (${eventId}, ${code}, 'fixed', ${discountKes}, 1, ${expiresAt.toISOString()}, true)
    `;

    await sql`
      INSERT INTO loyalty_transactions (email, points, reason)
      VALUES (${normalized}, ${-points}, 'redeemed')
    `;

    return { success: true, code, discountKes };
  });
}
'@
Write-ClaudeFile "lib\loyalty.ts" $content

Write-Host "Writing: lib\tickets.ts" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendTicketEmail } from '@/lib/email';
import { sendTicketConfirmationSms } from '@/lib/sms';
import { awardPointsForOrder } from '@/lib/loyalty';

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
    SELECT id, payment_status, ticket_type_id, quantity, buyer_name, buyer_email, buyer_phone, event_id, promo_code_id, total_amount_kes
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

    // Non-blocking: a loyalty-points failure should never stop ticket issuance.
    awardPointsForOrder(order.id, order.buyer_email, Number(order.total_amount_kes || 0));
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

Write-Host "Writing: app\api\loyalty\route.ts" -ForegroundColor Cyan
$content = @'
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getLoyaltySummary } from '@/lib/loyalty';

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await getLoyaltySummary(session.email);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('loyalty GET error:', err?.message || err);
    return NextResponse.json({ balance: 0, lifetimeEarned: 0, tier: 'Bronze' }, { status: 503 });
  }
}
'@
Write-ClaudeFile "app\api\loyalty\route.ts" $content

Write-Host "Writing: app\api\loyalty\redeem\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { redeemPointsForEvent, MIN_REDEMPTION_POINTS } from '@/lib/loyalty';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'Please log in to redeem points' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const eventId = String(body.eventId || '').trim();
  const points = Number(body.points);

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }
  if (!Number.isFinite(points) || points < MIN_REDEMPTION_POINTS) {
    return NextResponse.json(
      { error: `Minimum redemption is ${MIN_REDEMPTION_POINTS} points` },
      { status: 400 }
    );
  }

  try {
    const result = await redeemPointsForEvent(session.email, eventId, Math.floor(points));
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('loyalty redeem error:', err?.message || err);
    return NextResponse.json({ error: 'Could not redeem points right now. Try again shortly.' }, { status: 503 });
  }
}
'@
Write-ClaudeFile "app\api\loyalty\redeem\route.ts" $content

Write-Host "Writing: app\attendee\dashboard\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import ShareTicket from './ShareTicket';
import TransferTicketButton from './TransferTicketButton';
import LoyaltyPanel from './LoyaltyPanel';
import { getLoyaltySummary } from '@/lib/loyalty';

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

  let loyaltySummary = { balance: 0, lifetimeEarned: 0, tier: 'Bronze' as const };
  try {
    loyaltySummary = await getLoyaltySummary(session.email);
  } catch (err) {
    console.error('Failed to load loyalty summary:', err);
  }

  const redeemableEvents = await sql`
    SELECT id, title, slug
    FROM events
    WHERE status = 'published' AND start_at > NOW()
    ORDER BY start_at ASC
    LIMIT 50
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

      <div className="mb-8">
        <LoyaltyPanel
          initialSummary={loyaltySummary}
          events={redeemableEvents.map((e: any) => ({ id: e.id, title: e.title }))}
        />
      </div>

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

Write-Host "Writing: app\attendee\dashboard\LoyaltyPanel.tsx" -ForegroundColor Cyan
$content = @'
'use client';
import { useState } from 'react';

type Tier = 'Bronze' | 'Silver' | 'Gold';

interface Summary {
  balance: number;
  lifetimeEarned: number;
  tier: Tier;
}

const TIER_STYLES: Record<Tier, { bg: string; text: string; ring: string }> = {
  Bronze: { bg: 'bg-amber-950/50', text: 'text-amber-400', ring: 'border-amber-800' },
  Silver: { bg: 'bg-slate-800/60', text: 'text-slate-300', ring: 'border-slate-600' },
  Gold: { bg: 'bg-yellow-950/40', text: 'text-yellow-400', ring: 'border-yellow-700' },
};

export default function LoyaltyPanel({
  initialSummary,
  events,
}: {
  initialSummary: Summary;
  events: { id: string; title: string }[];
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id || '');
  const [points, setPoints] = useState(Math.min(100, summary.balance));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; discountKes: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const tierStyle = TIER_STYLES[summary.tier];

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!eventId) {
      setError('Pick an event to redeem toward');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, points }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not redeem points');
        return;
      }
      setResult({ code: data.code, discountKes: data.discountKes });
      setSummary((s) => ({ ...s, balance: s.balance - points }));
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!result) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Loyalty points</p>
            <p className="text-2xl font-extrabold text-white">{summary.balance.toLocaleString()}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.ring}`}>
            {summary.tier} member
          </span>
        </div>
        {events.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-sm font-semibold text-indigo-400 hover:text-cyan-400"
          >
            {open ? 'Close' : 'Redeem points →'}
          </button>
        )}
      </div>

      {summary.lifetimeEarned > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {summary.lifetimeEarned.toLocaleString()} points earned lifetime. Earn 1 point per KES 100 spent.
        </p>
      )}

      {open && (
        <form onSubmit={handleRedeem} className="mt-4 pt-4 border-t border-gray-800 space-y-3">
          {result ? (
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4">
              <p className="text-emerald-300 text-sm font-semibold mb-2">
                Redeemed! KES {result.discountKes.toLocaleString()} off your next order.
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white flex-1">
                  {result.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Apply this code at checkout for the event you picked. Expires in 30 days, single use.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Redeem toward
                </label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Points to redeem (min 100, 1 point = KES 1 off)
                </label>
                <input
                  type="number"
                  min={100}
                  step={10}
                  max={summary.balance}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || summary.balance < 100}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition"
              >
                {busy ? 'Redeeming...' : summary.balance < 100 ? 'Not enough points yet' : 'Get discount code'}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
'@
Write-ClaudeFile "app\attendee\dashboard\LoyaltyPanel.tsx" $content

Write-Host ""
Write-Host "Done. Files updated:" -ForegroundColor Green
Write-Host "  - migrations\009_loyalty_points.sql (NEW)"
Write-Host "  - schema.sql"
Write-Host "  - lib\loyalty.ts (NEW)"
Write-Host "  - lib\tickets.ts"
Write-Host "  - app\api\loyalty\route.ts (NEW)"
Write-Host "  - app\api\loyalty\redeem\route.ts (NEW)"
Write-Host "  - app\attendee\dashboard\page.tsx"
Write-Host "  - app\attendee\dashboard\LoyaltyPanel.tsx (NEW)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git log --oneline -3   (sanity check before force-pushing)"
Write-Host "  git add -A"
Write-Host "  git commit -m ""Add loyalty points: earn on purchase, redeem as promo codes"""
Write-Host "  git push --force"
Write-Host ""
Write-Host "No manual migration step required - the table self-heals on first" -ForegroundColor Yellow
Write-Host "use, same pattern as the favorites feature." -ForegroundColor Yellow

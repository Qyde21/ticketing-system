-- Ticketing System — database schema
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
-- schema changes — provider + provider_user_id together are unique.
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
  paystack_reference  TEXT,
  is_flash_sale       BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_paystack_reference ON orders (paystack_reference);

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
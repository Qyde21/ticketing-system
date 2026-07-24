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
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'attendee', -- 'attendee' | 'organizer' | 'admin'
  status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
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
  status           TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published' | 'cancelled'
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
  max_per_order  INTEGER NOT NULL DEFAULT 10
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
  payment_status      TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'refunded'
  paystack_reference  TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  ticket_code    TEXT UNIQUE NOT NULL,
  holder_name    TEXT,
  status         TEXT NOT NULL DEFAULT 'valid', -- 'valid' | 'used' | 'cancelled'
  checked_in_at  TIMESTAMPTZ
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
CREATE TABLE login_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  ip         TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

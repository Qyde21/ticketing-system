ALTER TABLE organizer_profiles
  ADD COLUMN IF NOT EXISTS payout_method TEXT,
  ADD COLUMN IF NOT EXISTS payout_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_phone TEXT,
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code TEXT,
  ADD COLUMN IF NOT EXISTS payout_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS organizer_payouts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id           UUID NOT NULL REFERENCES users(id),
  event_id               UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  gross_kes              NUMERIC NOT NULL DEFAULT 0,
  refunded_kes           NUMERIC NOT NULL DEFAULT 0,
  platform_fee_kes       NUMERIC NOT NULL DEFAULT 0,
  net_kes                NUMERIC NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  paystack_reference     TEXT UNIQUE,
  paystack_transfer_code TEXT,
  failure_reason         TEXT,
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at           TIMESTAMPTZ,
  paid_at                TIMESTAMPTZ,
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_organizer_payouts_organizer
  ON organizer_payouts (organizer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_organizer_payouts_status
  ON organizer_payouts (status) WHERE status IN ('pending', 'processing', 'failed');

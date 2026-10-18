-- 1) Password login now requires a confirmed email address. Email verification
--    was introduced on 2026-08-03, so every account created before that date
--    could never have confirmed one - treat those as verified so existing
--    users aren't locked out. Accounts created since then that never clicked
--    their confirmation link must confirm (or use "Forgot password").
UPDATE users
SET email_verified = true
WHERE email_verified = false AND created_at < '2026-08-03';

-- 2) Audit trail for ticket transfers. A transfer now also issues the ticket a
--    new code (so the previous holder's QR stops working); this records who
--    moved which ticket to whom, with both codes, for support and disputes.
CREATE TABLE IF NOT EXISTS ticket_transfers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_email  TEXT,
  from_name   TEXT,
  to_email    TEXT NOT NULL,
  to_name     TEXT NOT NULL,
  old_code    TEXT NOT NULL,
  new_code    TEXT NOT NULL,
  by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_transfers_ticket_idx ON ticket_transfers (ticket_id, created_at DESC);

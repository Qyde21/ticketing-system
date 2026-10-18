-- TOTP replay protection: remember the highest 30-second step already
-- accepted for a user, so the same 6-digit code can't be used twice (a code
-- is otherwise valid for up to ~90 seconds with the clock-drift allowance).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;

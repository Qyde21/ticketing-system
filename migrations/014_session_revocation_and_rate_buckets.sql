-- 1) Session revocation. Sessions are stateless JWTs; a password reset now
--    sets sessions_valid_after so every token issued before it stops working.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sessions_valid_after TIMESTAMPTZ;

-- 2) Atomic rate-limit counters for credential-guessing endpoints (login,
--    2FA code, email OTP). One row per (type, email|ip) key; the counter is
--    bumped with a single UPSERT, so concurrent requests cannot all slip
--    under the limit the way a separate "count then record" check allows.
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

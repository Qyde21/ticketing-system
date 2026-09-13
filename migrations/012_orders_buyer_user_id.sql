-- This column already exists on production — it was added directly against
-- the live database outside of a migration file (discovered during a round
-- check on 2026-09-13). This migration exists purely so schema.sql and the
-- migrations/ history accurately reflect reality; the ADD COLUMN IF NOT
-- EXISTS makes it a safe no-op wherever the column is already present, and
-- correctly brings a fresh database (staging, disaster recovery) up to date
-- wherever it isn't.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_user_id UUID REFERENCES users(id);

-- A single checkout can create multiple `orders` rows that share one
-- Paystack reference (one row per ticket tier in a multi-tier cart) — the
-- verify and webhook routes already expect and sum across multiple rows
-- per reference. The old UNIQUE constraint on paystack_reference blocked
-- this: only the first tier's order insert would succeed, and every
-- multi-tier checkout failed with a duplicate key error on the second.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_paystack_reference_key;

-- Replace the unique index with a plain index so lookups by reference
-- (verify redirect, webhook, status polling) stay fast without blocking
-- multiple rows from sharing a reference.
CREATE INDEX IF NOT EXISTS idx_orders_paystack_reference ON orders (paystack_reference);

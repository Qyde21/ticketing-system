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
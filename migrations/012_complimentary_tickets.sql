-- Complimentary (comp) tickets: organizer- or admin-issued free tickets that
-- bypass Paystack entirely, for a specific named recipient. Distinct from a
-- promo code discounting an order to KES 0, so organizers can tell the two
-- apart in their orders list and reporting.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comp_note TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_is_complimentary ON orders (is_complimentary) WHERE is_complimentary = true;

-- Flash sale support for ticket_types.
-- A flash sale is active when: flash_sale_price_kes IS NOT NULL,
-- now() is between flash_sale_starts_at and flash_sale_ends_at, and
-- (flash_sale_quantity_cap IS NULL OR flash_sale_quantity_sold < flash_sale_quantity_cap).

ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS flash_sale_price_kes NUMERIC,
  ADD COLUMN IF NOT EXISTS flash_sale_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_quantity_cap INTEGER,
  ADD COLUMN IF NOT EXISTS flash_sale_quantity_sold INTEGER NOT NULL DEFAULT 0;

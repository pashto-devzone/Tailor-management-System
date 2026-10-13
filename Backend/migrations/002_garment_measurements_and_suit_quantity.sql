-- Add garment-specific measurement records and suit quantity without changing
-- existing customer/order rows. Safe to re-run on PostgreSQL 9.6+.
ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS dress_type TEXT NOT NULL DEFAULT 'shalwar kameez';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS suit_quantity INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_suit_quantity_positive'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_suit_quantity_positive CHECK (suit_quantity > 0);
  END IF;
END
$$;

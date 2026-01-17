-- Add variant_key to reservations table
-- Migration: 20250116000009_add_variant_key_to_reservations
-- 
-- This migration adds variant_key support to reservations to track which
-- product variant was selected when the reservation was made.

-- Add variant_key column (default 'default')
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS variant_key TEXT DEFAULT 'default' NOT NULL;

-- Add index for variant_key
CREATE INDEX IF NOT EXISTS idx_reservations_variant_key 
  ON reservations(variant_key);

-- Add composite index for common queries (product_id, channel_id, variant_key)
CREATE INDEX IF NOT EXISTS idx_reservations_product_channel_variant 
  ON reservations(product_id, channel_id, variant_key);

-- Add comment
COMMENT ON COLUMN reservations.variant_key IS 
  'Variant identifier matching channel_products.variant_key. Indicates which product variant was selected when the reservation was made. Default is ''default''.';

-- Update existing records to have 'default' variant_key
UPDATE reservations
SET variant_key = 'default'
WHERE variant_key IS NULL;

-- Add variant_key to dynamic_pricing table
-- Migration: 20250116000007_add_variant_key_to_dynamic_pricing
-- 
-- This migration adds variant_key to dynamic_pricing to support multiple
-- pricing variants per product-channel-date combination.
-- variant_key works together with price_type to provide flexible pricing options.

-- Add variant_key column (default 'default')
ALTER TABLE dynamic_pricing
ADD COLUMN IF NOT EXISTS variant_key TEXT DEFAULT 'default' NOT NULL;

-- Drop the existing unique constraint
ALTER TABLE dynamic_pricing
DROP CONSTRAINT IF EXISTS dynamic_pricing_product_channel_date_type_key;

-- Add new unique constraint including variant_key
ALTER TABLE dynamic_pricing
ADD CONSTRAINT dynamic_pricing_product_channel_date_type_variant_key 
UNIQUE(product_id, channel_id, date, price_type, variant_key);

-- Update composite index to include variant_key
DROP INDEX IF EXISTS idx_dynamic_pricing_composite;
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_composite 
ON dynamic_pricing(product_id, channel_id, date, price_type, variant_key);

-- Add index for variant_key
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_variant_key 
ON dynamic_pricing(variant_key);

-- Add comment
COMMENT ON COLUMN dynamic_pricing.variant_key IS 
  'Variant identifier matching channel_products.variant_key. Works together with price_type to allow multiple pricing structures per product-channel-date. Default is ''default''.';

-- Update existing records to have 'default' variant_key
UPDATE dynamic_pricing
SET variant_key = 'default'
WHERE variant_key IS NULL;

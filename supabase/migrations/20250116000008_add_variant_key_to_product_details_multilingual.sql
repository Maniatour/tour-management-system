-- Add variant_key to product_details_multilingual table
-- Migration: 20250116000008_add_variant_key_to_product_details_multilingual
-- 
-- This migration adds variant_key support to allow multiple product details
-- per channel-variant combination. Each variant can have different product details.

-- Add variant_key column (default 'default')
ALTER TABLE product_details_multilingual
ADD COLUMN IF NOT EXISTS variant_key TEXT DEFAULT 'default' NOT NULL;

-- Drop existing unique constraints/indexes
DROP INDEX IF EXISTS product_details_multilingual_product_lang_channel_unique;
DROP INDEX IF EXISTS product_details_multilingual_product_lang_null_unique;

-- Add new unique constraint including variant_key for channel_id NOT NULL case
CREATE UNIQUE INDEX IF NOT EXISTS product_details_multilingual_product_lang_channel_variant_unique 
  ON product_details_multilingual (product_id, language_code, channel_id, variant_key)
  WHERE channel_id IS NOT NULL;

-- Add new unique constraint including variant_key for channel_id NULL case
CREATE UNIQUE INDEX IF NOT EXISTS product_details_multilingual_product_lang_variant_null_unique 
  ON product_details_multilingual (product_id, language_code, variant_key)
  WHERE channel_id IS NULL;

-- Update composite index to include variant_key
DROP INDEX IF EXISTS idx_product_details_multilingual_product_channel_lang;
CREATE INDEX IF NOT EXISTS idx_product_details_multilingual_product_channel_lang_variant 
  ON product_details_multilingual (product_id, channel_id, language_code, variant_key);

-- Add index for variant_key
CREATE INDEX IF NOT EXISTS idx_product_details_multilingual_variant_key 
  ON product_details_multilingual(variant_key);

-- Add comment
COMMENT ON COLUMN product_details_multilingual.variant_key IS 
  'Variant identifier matching channel_products.variant_key. Allows different product details per variant. Default is ''default''.';

-- Update existing records to have 'default' variant_key
UPDATE product_details_multilingual
SET variant_key = 'default'
WHERE variant_key IS NULL;

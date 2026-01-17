-- Add variant_key to channel_products and channel_inclusions_exclusions
-- Migration: 20250116000006_add_variant_key_to_channel_products
-- 
-- This migration adds variant_key support to allow multiple product variants
-- per channel. For example, Klook may sell the same tour with two different
-- pricing structures:
-- 1. All-inclusive (no excluded price)
-- 2. With excluded price (payable on tour day)
--
-- Each variant can have different pricing, inclusions, and exclusions.

-- Step 1: Add variant_key to channel_products table
ALTER TABLE channel_products
ADD COLUMN IF NOT EXISTS variant_key TEXT DEFAULT 'default' NOT NULL;

-- Add variant_name and variant_description for better UI display
ALTER TABLE channel_products
ADD COLUMN IF NOT EXISTS variant_name_ko TEXT,
ADD COLUMN IF NOT EXISTS variant_name_en TEXT,
ADD COLUMN IF NOT EXISTS variant_description_ko TEXT,
ADD COLUMN IF NOT EXISTS variant_description_en TEXT;

-- Drop the existing unique constraint
ALTER TABLE channel_products
DROP CONSTRAINT IF EXISTS channel_products_channel_id_product_id_key;

-- Add new unique constraint including variant_key
ALTER TABLE channel_products
ADD CONSTRAINT channel_products_channel_product_variant_key 
UNIQUE(channel_id, product_id, variant_key);

-- Update composite index to include variant_key
DROP INDEX IF EXISTS idx_channel_products_composite;
CREATE INDEX IF NOT EXISTS idx_channel_products_composite 
ON channel_products(channel_id, product_id, variant_key);

-- Add index for variant_key
CREATE INDEX IF NOT EXISTS idx_channel_products_variant_key 
ON channel_products(variant_key);

-- Add comments
COMMENT ON COLUMN channel_products.variant_key IS 
  'Variant identifier for the same product in the same channel. Default is ''default''. Allows multiple variants like ''all_inclusive'', ''with_exclusions'', etc.';

COMMENT ON COLUMN channel_products.variant_name_ko IS 
  'Variant display name in Korean (e.g., ''모든 금액 포함'', ''불포함 금액 있음'')';

COMMENT ON COLUMN channel_products.variant_name_en IS 
  'Variant display name in English (e.g., ''All Inclusive'', ''With Exclusions'')';

COMMENT ON COLUMN channel_products.variant_description_ko IS 
  'Variant description in Korean';

COMMENT ON COLUMN channel_products.variant_description_en IS 
  'Variant description in English';

-- Step 2: Add variant_key to channel_inclusions_exclusions table
-- First check if table exists, if not, we'll create it in a separate migration
DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'channel_inclusions_exclusions'
  ) THEN
    -- Add variant_key column
    ALTER TABLE channel_inclusions_exclusions
    ADD COLUMN IF NOT EXISTS variant_key TEXT DEFAULT 'default' NOT NULL;

    -- Drop the existing unique constraint
    ALTER TABLE channel_inclusions_exclusions
    DROP CONSTRAINT IF EXISTS channel_inclusions_exclusions_product_id_channel_id_key;

    -- Add new unique constraint including variant_key
    ALTER TABLE channel_inclusions_exclusions
    ADD CONSTRAINT channel_inclusions_exclusions_product_channel_variant_key 
    UNIQUE(product_id, channel_id, variant_key);

    -- Update composite index to include variant_key
    DROP INDEX IF EXISTS idx_channel_inclusions_exclusions_composite;
    CREATE INDEX IF NOT EXISTS idx_channel_inclusions_exclusions_composite 
    ON channel_inclusions_exclusions(product_id, channel_id, variant_key);

    -- Add index for variant_key
    CREATE INDEX IF NOT EXISTS idx_channel_inclusions_exclusions_variant_key 
    ON channel_inclusions_exclusions(variant_key);

    -- Add comment
    COMMENT ON COLUMN channel_inclusions_exclusions.variant_key IS 
      'Variant identifier matching channel_products.variant_key. Allows different inclusions/exclusions per variant.';
  END IF;
END $$;

-- Step 3: Update existing records to have 'default' variant_key (if not already set)
UPDATE channel_products
SET variant_key = 'default'
WHERE variant_key IS NULL;

-- Update channel_inclusions_exclusions only if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'channel_inclusions_exclusions'
  ) THEN
    UPDATE channel_inclusions_exclusions
    SET variant_key = 'default'
    WHERE variant_key IS NULL;
  END IF;
END $$;

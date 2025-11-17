-- Add price_type column to dynamic_pricing table
-- Migration: 20250129000009_add_price_type_to_dynamic_pricing
-- 
-- This migration adds a price_type column to distinguish between:
-- - 'dynamic': 동적 가격 (불포함 금액이 있는 경우)
-- - 'base': 기본 가격 (불포함 금액이 없는 경우)
-- 
-- The unique constraint is updated to include price_type:
-- UNIQUE(product_id, channel_id, date, price_type)

-- Add price_type column (varchar, default 'dynamic')
ALTER TABLE public.dynamic_pricing
ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'dynamic' NOT NULL;

-- Add check constraint to ensure price_type is either 'dynamic' or 'base'
ALTER TABLE public.dynamic_pricing
ADD CONSTRAINT check_price_type 
CHECK (price_type IN ('dynamic', 'base'));

-- Update existing records to have default value 'dynamic'
UPDATE public.dynamic_pricing 
SET price_type = 'dynamic' 
WHERE price_type IS NULL;

-- Drop the existing unique constraint
ALTER TABLE public.dynamic_pricing
DROP CONSTRAINT IF EXISTS dynamic_pricing_product_id_channel_id_date_key;

-- Add new unique constraint including price_type
ALTER TABLE public.dynamic_pricing
ADD CONSTRAINT dynamic_pricing_product_channel_date_type_key 
UNIQUE(product_id, channel_id, date, price_type);

-- Update composite index to include price_type
DROP INDEX IF EXISTS idx_dynamic_pricing_composite;
CREATE INDEX idx_dynamic_pricing_composite 
ON dynamic_pricing(product_id, channel_id, date, price_type);

-- Add index for price_type for better query performance
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_price_type 
ON dynamic_pricing(price_type);

-- Add comment to explain the column
COMMENT ON COLUMN public.dynamic_pricing.price_type IS 
'Type of pricing: ''dynamic'' (동적 가격, 불포함 금액이 있는 경우), ''base'' (기본 가격, 불포함 금액이 없는 경우). Allows same product-channel-date combination to have both types.';


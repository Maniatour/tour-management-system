-- Add not_included_price related columns to channels table
-- Migration: 20250128000000_add_not_included_price_to_channels
-- 
-- This migration adds fields to manage not included price settings at the channel level:
-- - has_not_included_price: Whether the channel has not included price
-- - not_included_type: Type of not included price ('none' | 'amount_only' | 'amount_and_choice')
-- - not_included_price: The amount that is not included

-- Add has_not_included_price column (boolean, default false)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS has_not_included_price BOOLEAN DEFAULT false;

-- Add not_included_type column (varchar, default 'none')
ALTER TABLE channels ADD COLUMN IF NOT EXISTS not_included_type VARCHAR(50) DEFAULT 'none';

-- Add not_included_price column (numeric, default 0)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS not_included_price NUMERIC(10, 2) DEFAULT 0;

-- Add comments to explain the columns
COMMENT ON COLUMN channels.has_not_included_price IS 
  'Whether this channel has not included price. If true, not_included_price will be added to balance amount.';

COMMENT ON COLUMN channels.not_included_type IS 
  'Type of not included price: ''none'' (no not included price), ''amount_only'' (only not_included_price amount), ''amount_and_choice'' (not_included_price + choice price).';

COMMENT ON COLUMN channels.not_included_price IS 
  'Amount per adult that is not included in the base price. This amount will be added to balance amount.';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_channels_has_not_included_price ON channels(has_not_included_price);
CREATE INDEX IF NOT EXISTS idx_channels_not_included_type ON channels(not_included_type);


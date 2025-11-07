-- Add commission_base_price_only column to channels table
-- This column determines whether commission should be applied only to base product price (excluding choices and not_included_price)
-- Migration: 20250126000000_add_commission_base_price_only_to_channels

-- Add commission_base_price_only column (boolean, default false)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS commission_base_price_only BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN channels.commission_base_price_only IS 
  'If true, commission is applied only to base product price (excluding choices and not_included_price). Choices and not_included_price will be added to balance amount. If false, commission is applied to total price including all components.';

-- Create index for better query performance (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_channels_commission_base_price_only ON channels(commission_base_price_only);


-- Add commission_adult_only column to channels table
-- This column determines whether commission and coupon discounts should be applied only to adult prices
-- Migration: 20250125000000_add_commission_adult_only_to_channels

-- Add commission_adult_only column (boolean, default false)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS commission_adult_only BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN channels.commission_adult_only IS 
  'If true, commission and coupon discounts are applied only to adult prices. If false, they are applied to all prices (adult, child, infant).';

-- Create index for better query performance (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_channels_commission_adult_only ON channels(commission_adult_only);


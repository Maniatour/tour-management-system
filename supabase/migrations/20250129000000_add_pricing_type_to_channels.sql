-- Add pricing_type column to channels table
-- Migration: 20250129000000_add_pricing_type_to_channels
-- 
-- This migration adds a pricing_type field to determine whether a channel
-- uses separate prices for adult/child/infant or a single price for all.

-- Add pricing_type column (varchar, default 'separate')
-- 'separate': 성인/아동/유아 가격을 각각 판매
-- 'single': 단일 가격으로 판매
ALTER TABLE channels ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(50) DEFAULT 'separate';

-- Add comment to explain the column
COMMENT ON COLUMN channels.pricing_type IS
  'Pricing type for the channel: ''separate'' (separate prices for adult/child/infant) or ''single'' (single price for all).';

-- Update existing records to ensure defaults are applied
UPDATE channels SET pricing_type = 'separate' WHERE pricing_type IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_channels_pricing_type ON channels(pricing_type);


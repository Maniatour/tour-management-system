-- Drop seasonal_pricing table (replaced by dynamic_pricing)
-- Migration: 20250101000004_drop_seasonal_pricing

-- Drop the seasonal_pricing table
DROP TABLE IF EXISTS seasonal_pricing;

-- Add comment to document the change
COMMENT ON TABLE dynamic_pricing IS 'Dynamic pricing table - replaces seasonal_pricing with more flexible pricing system';

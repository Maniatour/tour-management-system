-- Remove difficulty and min_participants columns from products table
-- Migration: 20250101000001_remove_difficulty_min_participants

-- Remove difficulty column
ALTER TABLE products DROP COLUMN IF EXISTS difficulty;

-- Remove min_participants column
ALTER TABLE products DROP COLUMN IF EXISTS min_participants;

-- Add comment to document the change
COMMENT ON TABLE products IS 'Products table - removed difficulty and min_participants columns';

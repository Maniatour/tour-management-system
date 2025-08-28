-- Remove min_quantity and max_quantity columns from options table
-- Migration: 20250101000002_remove_min_max_quantity

-- Remove min_quantity column
ALTER TABLE options DROP COLUMN IF EXISTS min_quantity;

-- Remove max_quantity column
ALTER TABLE options DROP COLUMN IF EXISTS max_quantity;

-- Add comment to document the change
COMMENT ON TABLE options IS 'Options table - removed min_quantity and max_quantity columns';

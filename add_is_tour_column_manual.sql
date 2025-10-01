-- Add is_tour column to product_schedules table
-- Run this SQL in Supabase Dashboard > SQL Editor

ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS is_tour BOOLEAN DEFAULT FALSE;

-- Add comment to the column
COMMENT ON COLUMN product_schedules.is_tour IS 'Whether this schedule item is a tour/sightseeing activity';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND column_name = 'is_tour';

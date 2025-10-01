-- Manual SQL to add thumbnail_url column to product_schedules
-- Run this in Supabase SQL Editor if migration doesn't work

-- Add thumbnail_url column to product_schedules table
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment to the column
COMMENT ON COLUMN product_schedules.thumbnail_url IS 'Schedule thumbnail image URL';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND column_name = 'thumbnail_url';

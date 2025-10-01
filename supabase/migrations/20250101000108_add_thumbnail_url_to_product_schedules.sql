-- Add thumbnail_url column to product_schedules table
-- Migration: 20250101000108_add_thumbnail_url_to_product_schedules

-- Add thumbnail_url column to product_schedules table
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment to the column
COMMENT ON COLUMN product_schedules.thumbnail_url IS 'Schedule thumbnail image URL';

-- Add thumbnail_path column to tour_photos table
-- Migration: 20250216000000_add_thumbnail_path_to_tour_photos

ALTER TABLE tour_photos 
ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

-- Add comment
COMMENT ON COLUMN tour_photos.thumbnail_path IS 'Path to the thumbnail image in Supabase Storage';


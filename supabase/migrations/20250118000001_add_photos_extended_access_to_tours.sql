-- Add photos_extended_access column to tours table
-- Migration: 20250118000001_add_photos_extended_access_to_tours
-- This column allows admins to extend customer access to tour photos beyond the 7-day limit

-- Add the column if it doesn't exist
ALTER TABLE public.tours
ADD COLUMN IF NOT EXISTS photos_extended_access BOOLEAN DEFAULT false;

-- Add comment for the column
COMMENT ON COLUMN public.tours.photos_extended_access IS 
'When true, allows customers to access tour photos even after 7 days from tour date. Can be toggled from tour detail page.';

-- Update existing records to have default value false
UPDATE public.tours 
SET photos_extended_access = false 
WHERE photos_extended_access IS NULL;

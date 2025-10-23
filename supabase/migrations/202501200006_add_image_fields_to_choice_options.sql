-- Add image fields to choice_options table
-- Migration: 202501200006_add_image_fields_to_choice_options

-- Add image fields to choice_options table
ALTER TABLE choice_options 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_alt TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN choice_options.image_url IS 'URL of the choice option image';
COMMENT ON COLUMN choice_options.image_alt IS 'Alt text for the choice option image';
COMMENT ON COLUMN choice_options.thumbnail_url IS 'URL of the choice option thumbnail image';

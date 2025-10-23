-- Add description fields to choice_options table
-- Migration: 202501200005_add_description_fields_to_choice_options

-- Add description fields to choice_options table
ALTER TABLE choice_options 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS description_ko TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN choice_options.description IS 'English description of the choice option';
COMMENT ON COLUMN choice_options.description_ko IS 'Korean description of the choice option';

-- Add image fields to product_options table
-- Migration: add_image_fields_to_product_options

-- Add image fields to product_options table
ALTER TABLE product_options 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_alt TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN product_options.image_url IS 'URL of the product option image';
COMMENT ON COLUMN product_options.image_alt IS 'Alt text for the product option image';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_product_options_image_url ON product_options(image_url) WHERE image_url IS NOT NULL;


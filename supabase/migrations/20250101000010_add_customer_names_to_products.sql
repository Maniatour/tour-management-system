-- Add customer-facing names to products table
-- This migration adds English and Korean full names for customers to see

-- Add new columns for customer-facing names
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ko VARCHAR(255);

-- Add display_name column that combines both languages
ALTER TABLE products ADD COLUMN IF NOT EXISTS display_name JSONB;

-- Update existing products to have display names
-- For now, we'll set the English and Korean names to be the same as the internal name
UPDATE products 
SET 
  name_en = name,
  name_ko = name,
  display_name = jsonb_build_object('en', name, 'ko', name)
WHERE name_en IS NULL;

-- Make the new columns NOT NULL after setting default values
ALTER TABLE products ALTER COLUMN name_en SET NOT NULL;
ALTER TABLE products ALTER COLUMN name_ko SET NOT NULL;

-- Add comments to explain the purpose of each column
COMMENT ON COLUMN products.name IS 'Internal name for admin use';
COMMENT ON COLUMN products.name_en IS 'English name displayed to customers';
COMMENT ON COLUMN products.name_ko IS 'Korean name displayed to customers';
COMMENT ON COLUMN products.display_name IS 'JSON object containing names in multiple languages';

-- Create an index on the new name columns for better search performance
CREATE INDEX IF NOT EXISTS idx_products_name_en ON products(name_en);
CREATE INDEX IF NOT EXISTS idx_products_name_ko ON products(name_ko);

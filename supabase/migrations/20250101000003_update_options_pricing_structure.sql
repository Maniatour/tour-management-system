-- Update options table pricing structure
-- Migration: 20250101000003_update_options_pricing_structure

-- Add new price columns
ALTER TABLE options ADD COLUMN IF NOT EXISTS adult_price DECIMAL(10,2);
ALTER TABLE options ADD COLUMN IF NOT EXISTS child_price DECIMAL(10,2);
ALTER TABLE options ADD COLUMN IF NOT EXISTS infant_price DECIMAL(10,2);

-- Set default values for existing records (assuming base_price as adult_price)
UPDATE options SET 
  adult_price = base_price,
  child_price = base_price * 0.7,  -- 70% of adult price
  infant_price = base_price * 0.3  -- 30% of adult price
WHERE adult_price IS NULL;

-- Make new price columns NOT NULL after setting default values
ALTER TABLE options ALTER COLUMN adult_price SET NOT NULL;
ALTER TABLE options ALTER COLUMN child_price SET NOT NULL;
ALTER TABLE options ALTER COLUMN infant_price SET NOT NULL;

-- Remove old base_price column
ALTER TABLE options DROP COLUMN IF EXISTS base_price;

-- Add comment to document the change
COMMENT ON TABLE options IS 'Options table - updated pricing structure with separate adult/child/infant prices';

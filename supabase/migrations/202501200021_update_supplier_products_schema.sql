-- Update supplier_products table to support actual product and choice selection
-- This migration adds support for linking supplier products to actual products and their choices

-- Add new columns to supplier_products table
ALTER TABLE supplier_products 
ADD COLUMN IF NOT EXISTS choice_id TEXT, -- Choice option ID from product choices
ADD COLUMN IF NOT EXISTS choice_option_id TEXT, -- Specific choice option ID
ADD COLUMN IF NOT EXISTS markup_percent DECIMAL(5,2) DEFAULT 0, -- Markup percentage for dynamic pricing
ADD COLUMN IF NOT EXISTS markup_amount DECIMAL(10,2) DEFAULT 0, -- Fixed markup amount for dynamic pricing
ADD COLUMN IF NOT EXISTS adult_supplier_price DECIMAL(10,2), -- Adult supplier price
ADD COLUMN IF NOT EXISTS child_supplier_price DECIMAL(10,2), -- Child supplier price
ADD COLUMN IF NOT EXISTS infant_supplier_price DECIMAL(10,2), -- Infant supplier price
ADD COLUMN IF NOT EXISTS adult_season_price DECIMAL(10,2), -- Adult season price
ADD COLUMN IF NOT EXISTS child_season_price DECIMAL(10,2), -- Child season price
ADD COLUMN IF NOT EXISTS infant_season_price DECIMAL(10,2); -- Infant season price

-- Add comments for the new columns
COMMENT ON COLUMN supplier_products.choice_id IS 'ID of the choice group from product choices JSON';
COMMENT ON COLUMN supplier_products.choice_option_id IS 'ID of the specific choice option within the choice group';
COMMENT ON COLUMN supplier_products.markup_percent IS 'Percentage markup applied to supplier price for dynamic pricing';
COMMENT ON COLUMN supplier_products.markup_amount IS 'Fixed markup amount applied to supplier price for dynamic pricing';
COMMENT ON COLUMN supplier_products.adult_supplier_price IS 'Adult supplier price';
COMMENT ON COLUMN supplier_products.child_supplier_price IS 'Child supplier price';
COMMENT ON COLUMN supplier_products.infant_supplier_price IS 'Infant supplier price';
COMMENT ON COLUMN supplier_products.adult_season_price IS 'Adult season price';
COMMENT ON COLUMN supplier_products.child_season_price IS 'Child season price';
COMMENT ON COLUMN supplier_products.infant_season_price IS 'Infant season price';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_products_choice_id ON supplier_products(choice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_choice_option_id ON supplier_products(choice_option_id);

-- Update existing records to have default values
UPDATE supplier_products 
SET markup_percent = 0, markup_amount = 0 
WHERE markup_percent IS NULL OR markup_amount IS NULL;

-- Add constraint to ensure either product_id or choice_id is set (but not both required)
-- This allows for flexible supplier product configuration
ALTER TABLE supplier_products 
ADD CONSTRAINT check_supplier_product_reference 
CHECK (
  (product_id IS NOT NULL AND choice_id IS NULL) OR 
  (product_id IS NULL AND choice_id IS NOT NULL) OR
  (product_id IS NOT NULL AND choice_id IS NOT NULL)
);

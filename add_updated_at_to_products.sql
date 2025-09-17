-- Add updated_at column to products table
-- Run this directly in Supabase SQL Editor

BEGIN;

-- Add updated_at column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for products table
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing records to have updated_at = created_at
UPDATE products 
SET updated_at = created_at 
WHERE updated_at IS NULL;

COMMIT;

-- Verify the column was added
SELECT 
    'Products table updated_at column added successfully' as status,
    COUNT(*) as total_records,
    COUNT(updated_at) as records_with_updated_at
FROM products;

-- Remove product_id foreign key constraint from reservations table
-- This allows for flexible product_id values that may not exist in products table
-- Migration: 20250101000054_remove_product_id_foreign_key.sql

-- Step 1: Check if reservations table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations') THEN
        RAISE NOTICE 'reservations table does not exist, skipping migration';
        RETURN;
    END IF;
END $$;

-- Step 2: Drop the foreign key constraint if it exists
DO $$
BEGIN
    -- Check if the foreign key constraint exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'reservations' 
        AND constraint_name = 'reservations_product_id_fkey'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE reservations DROP CONSTRAINT reservations_product_id_fkey;
        RAISE NOTICE 'Dropped reservations_product_id_fkey constraint';
    ELSE
        RAISE NOTICE 'reservations_product_id_fkey constraint does not exist';
    END IF;
END $$;

-- Step 3: Create a temporary table to store invalid product_id values
CREATE TEMP TABLE invalid_product_ids AS
SELECT DISTINCT r.product_id
FROM reservations r
LEFT JOIN products p ON r.product_id = p.id
WHERE r.product_id IS NOT NULL 
  AND p.id IS NULL;

-- Step 4: Report invalid product_id values
DO $$
DECLARE
    invalid_count INTEGER;
    rec RECORD;
BEGIN
    SELECT COUNT(*) INTO invalid_count FROM invalid_product_ids;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Found % invalid product_id values:', invalid_count;
        
        FOR rec IN SELECT product_id FROM invalid_product_ids ORDER BY product_id
        LOOP
            RAISE NOTICE 'Invalid product_id: %', rec.product_id;
        END LOOP;
        
        RAISE NOTICE 'These product_id values do not exist in the products table.';
        RAISE NOTICE 'Please update these reservations with valid product_id values.';
    ELSE
        RAISE NOTICE 'All product_id values in reservations are valid.';
    END IF;
END $$;

-- Step 5: Create a view to help identify reservations with invalid product_id
CREATE OR REPLACE VIEW reservations_with_invalid_products AS
SELECT 
    r.id,
    r.product_id,
    r.customer_id,
    r.tour_date,
    r.status,
    r.created_at,
    CASE 
        WHEN p.id IS NULL THEN 'INVALID'
        ELSE 'VALID'
    END as product_status
FROM reservations r
LEFT JOIN products p ON r.product_id = p.id
WHERE r.product_id IS NOT NULL
ORDER BY r.created_at DESC;

-- Step 6: Add comment to explain the change
COMMENT ON TABLE reservations IS 'Reservations table - product_id is now TEXT without foreign key constraint for flexibility';
COMMENT ON COLUMN reservations.product_id IS 'Product ID (TEXT) - no foreign key constraint to allow flexible product references';

-- Step 7: Create index for better performance on product_id queries
CREATE INDEX IF NOT EXISTS idx_reservations_product_id ON reservations(product_id);

-- Step 8: Final status report
DO $$
DECLARE
    total_reservations INTEGER;
    invalid_reservations INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_reservations FROM reservations;
    SELECT COUNT(*) INTO invalid_reservations FROM reservations_with_invalid_products WHERE product_status = 'INVALID';
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Total reservations: %', total_reservations;
    RAISE NOTICE 'Reservations with invalid product_id: %', invalid_reservations;
    
    IF invalid_reservations > 0 THEN
        RAISE NOTICE 'Use the view "reservations_with_invalid_products" to identify and fix invalid product_id values.';
    END IF;
END $$;

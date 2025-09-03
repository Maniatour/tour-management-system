-- Fix invalid product_id values in reservations table
-- This migration helps update reservations with invalid product_id values
-- Migration: 20250101000055_fix_invalid_product_ids.sql

-- Step 1: Create a function to help map old product_id to new product_id
CREATE OR REPLACE FUNCTION map_product_id(old_product_id TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Add your product_id mapping logic here
    -- This is a template - customize based on your actual product mapping needs
    
    RETURN CASE old_product_id
        -- Example mappings (customize these based on your actual data)
        WHEN 'old-product-1' THEN 'NEW-PRODUCT-1'
        WHEN 'old-product-2' THEN 'NEW-PRODUCT-2'
        WHEN 'invalid-id' THEN 'DEFAULT-PRODUCT'
        -- Add more mappings as needed
        ELSE 'DEFAULT-PRODUCT' -- Default fallback
    END;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a table to store product_id mapping suggestions
CREATE TABLE IF NOT EXISTS product_id_mapping_suggestions (
    id SERIAL PRIMARY KEY,
    old_product_id TEXT NOT NULL UNIQUE,
    suggested_new_product_id TEXT,
    reservation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Populate mapping suggestions based on invalid product_id values
INSERT INTO product_id_mapping_suggestions (old_product_id, reservation_count)
SELECT 
    r.product_id,
    COUNT(*) as reservation_count
FROM reservations r
LEFT JOIN products p ON r.product_id = p.id
WHERE r.product_id IS NOT NULL 
  AND p.id IS NULL
GROUP BY r.product_id
ON CONFLICT (old_product_id) DO NOTHING;

-- Step 4: Create a view to show all invalid product_id values with suggestions
CREATE OR REPLACE VIEW invalid_product_id_report AS
SELECT 
    pims.old_product_id,
    pims.reservation_count,
    pims.suggested_new_product_id,
    CASE 
        WHEN p.id IS NOT NULL THEN 'SUGGESTED_PRODUCT_EXISTS'
        ELSE 'SUGGESTED_PRODUCT_NOT_FOUND'
    END as suggestion_status,
    p.name as suggested_product_name
FROM product_id_mapping_suggestions pims
LEFT JOIN products p ON pims.suggested_new_product_id = p.id
ORDER BY pims.reservation_count DESC;

-- Step 5: Create a function to update product_id for a specific old value
CREATE OR REPLACE FUNCTION update_product_id_mapping(
    old_id TEXT,
    new_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update the mapping suggestion
    UPDATE product_id_mapping_suggestions 
    SET suggested_new_product_id = new_id
    WHERE old_product_id = old_id;
    
    -- Update all reservations with the old product_id
    UPDATE reservations 
    SET product_id = new_id
    WHERE product_id = old_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % reservations from product_id "%" to "%"', updated_count, old_id, new_id;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a function to batch update all invalid product_id values
CREATE OR REPLACE FUNCTION batch_update_invalid_product_ids()
RETURNS TABLE(
    old_product_id TEXT,
    new_product_id TEXT,
    updated_count INTEGER
) AS $$
DECLARE
    rec RECORD;
    count INTEGER;
BEGIN
    -- Loop through all mapping suggestions and apply them
    FOR rec IN 
        SELECT old_product_id, suggested_new_product_id 
        FROM product_id_mapping_suggestions 
        WHERE suggested_new_product_id IS NOT NULL
    LOOP
        SELECT update_product_id_mapping(rec.old_product_id, rec.suggested_new_product_id) INTO count;
        
        old_product_id := rec.old_product_id;
        new_product_id := rec.suggested_new_product_id;
        updated_count := count;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Report current status
DO $$
DECLARE
    invalid_count INTEGER;
    total_suggestions INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count 
    FROM reservations r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.product_id IS NOT NULL AND p.id IS NULL;
    
    SELECT COUNT(*) INTO total_suggestions 
    FROM product_id_mapping_suggestions;
    
    RAISE NOTICE 'Product ID Fix Migration Ready!';
    RAISE NOTICE 'Invalid product_id values: %', invalid_count;
    RAISE NOTICE 'Mapping suggestions created: %', total_suggestions;
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Review the invalid_product_id_report view';
    RAISE NOTICE '2. Update suggested_new_product_id in product_id_mapping_suggestions table';
    RAISE NOTICE '3. Run: SELECT * FROM batch_update_invalid_product_ids();';
    RAISE NOTICE '4. Verify results with: SELECT * FROM reservations_with_invalid_products WHERE product_status = ''INVALID'';';
END $$;

-- Step 8: Add helpful comments
COMMENT ON FUNCTION map_product_id(TEXT) IS 'Maps old product_id to new product_id - customize this function for your specific needs';
COMMENT ON FUNCTION update_product_id_mapping(TEXT, TEXT) IS 'Updates all reservations with old product_id to new product_id';
COMMENT ON FUNCTION batch_update_invalid_product_ids() IS 'Batch updates all invalid product_id values based on mapping suggestions';
COMMENT ON VIEW invalid_product_id_report IS 'Shows all invalid product_id values with mapping suggestions';
COMMENT ON TABLE product_id_mapping_suggestions IS 'Stores mapping suggestions for invalid product_id values';

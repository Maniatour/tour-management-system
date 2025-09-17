-- Safe fix for tour_expenses foreign key constraint violations
-- This script provides multiple options to handle the issue safely

BEGIN;

-- Step 1: Analyze the problem
-- Check how many tour_expenses records have invalid tour_id references
SELECT 
    'Invalid tour_id references' as issue,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

-- Check how many tour_expenses records have invalid product_id references  
SELECT 
    'Invalid product_id references' as issue,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- Step 2: Show sample problematic data
SELECT 
    'Sample invalid tour_id records' as info,
    te.id,
    te.tour_id,
    te.tour_date,
    te.submitted_by,
    te.amount
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL
LIMIT 10;

-- Step 3: Create a backup table before making changes
CREATE TABLE IF NOT EXISTS tour_expenses_backup AS 
SELECT * FROM tour_expenses;

-- Step 4: Option A - Make tour_id nullable and set invalid references to NULL
-- This is the safest approach as it preserves all data

-- First, make tour_id nullable (if not already)
ALTER TABLE tour_expenses ALTER COLUMN tour_id DROP NOT NULL;

-- Set invalid tour_id references to NULL
UPDATE tour_expenses 
SET tour_id = NULL 
WHERE tour_id IS NOT NULL 
AND tour_id NOT IN (SELECT id FROM tours);

-- Set invalid product_id references to NULL (already nullable)
UPDATE tour_expenses 
SET product_id = NULL 
WHERE product_id IS NOT NULL 
AND product_id NOT IN (SELECT id FROM products);

-- Step 5: Verify the fixes
SELECT 
    'After fix - remaining invalid tour_id' as check_type,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

SELECT 
    'After fix - remaining invalid product_id' as check_type,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- Step 6: Show final summary
SELECT 
    'Final summary' as info,
    COUNT(*) as total_records,
    COUNT(tour_id) as records_with_tour_id,
    COUNT(product_id) as records_with_product_id,
    COUNT(CASE WHEN tour_id IS NOT NULL AND product_id IS NOT NULL THEN 1 END) as records_with_both
FROM tour_expenses;

COMMIT;

-- Additional: If you want to restore from backup, use:
-- DELETE FROM tour_expenses;
-- INSERT INTO tour_expenses SELECT * FROM tour_expenses_backup;

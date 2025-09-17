-- Fix tour_expenses foreign key constraint violations
-- This script identifies and fixes missing foreign key references

BEGIN;

-- 1. Check for orphaned tour_expenses records with invalid tour_id
SELECT 
    'tour_id violations' as issue_type,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE t.id IS NULL;

-- 2. Check for orphaned tour_expenses records with invalid product_id
SELECT 
    'product_id violations' as issue_type,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- 3. Show sample of problematic records
SELECT 
    'Sample tour_id violations' as issue_type,
    te.id,
    te.tour_id,
    te.product_id,
    te.tour_date,
    te.submitted_by
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE t.id IS NULL
LIMIT 5;

SELECT 
    'Sample product_id violations' as issue_type,
    te.id,
    te.tour_id,
    te.product_id,
    te.tour_date,
    te.submitted_by
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL
LIMIT 5;

-- 4. Option 1: Delete orphaned records (CAUTION: This will permanently delete data)
-- Uncomment the following lines if you want to delete orphaned records
/*
DELETE FROM tour_expenses 
WHERE tour_id NOT IN (SELECT id FROM tours);

DELETE FROM tour_expenses 
WHERE product_id IS NOT NULL 
AND product_id NOT IN (SELECT id FROM products);
*/

-- 5. Option 2: Set invalid foreign keys to NULL (safer approach)
-- This preserves the data but removes invalid references

-- Set invalid tour_id to NULL (this will fail if tour_id is NOT NULL)
-- First, we need to make tour_id nullable temporarily
ALTER TABLE tour_expenses ALTER COLUMN tour_id DROP NOT NULL;

-- Now set invalid tour_id references to NULL
UPDATE tour_expenses 
SET tour_id = NULL 
WHERE tour_id NOT IN (SELECT id FROM tours);

-- Set invalid product_id references to NULL (already nullable)
UPDATE tour_expenses 
SET product_id = NULL 
WHERE product_id IS NOT NULL 
AND product_id NOT IN (SELECT id FROM products);

-- 6. Verify the fixes
SELECT 
    'After fix - tour_id violations' as issue_type,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE t.id IS NULL AND te.tour_id IS NOT NULL;

SELECT 
    'After fix - product_id violations' as issue_type,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- 7. Show summary of remaining data
SELECT 
    'Summary' as info_type,
    COUNT(*) as total_tour_expenses,
    COUNT(tour_id) as with_tour_id,
    COUNT(product_id) as with_product_id
FROM tour_expenses;

COMMIT;

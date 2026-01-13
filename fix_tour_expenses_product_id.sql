-- 투어 지출의 product_id 자동 수정
-- tour_expenses의 product_id가 null이거나 잘못된 경우, 투어의 product_id로 업데이트

BEGIN;

-- 1. 현재 상황 분석
SELECT 
    'Current Analysis' as section,
    'Total tour_expenses records' as metric,
    COUNT(*) as value
FROM tour_expenses

UNION ALL

SELECT 
    'Current Analysis',
    'Records with null product_id',
    COUNT(*)
FROM tour_expenses
WHERE product_id IS NULL

UNION ALL

SELECT 
    'Current Analysis',
    'Records with invalid product_id',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL

UNION ALL

SELECT 
    'Current Analysis',
    'Records with valid tour_id but missing product_id',
    COUNT(*)
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id
WHERE (te.product_id IS NULL OR te.product_id NOT IN (SELECT id FROM products))
AND t.product_id IS NOT NULL;

-- 2. product_id가 null이거나 잘못된 경우, 투어의 product_id로 업데이트
UPDATE tour_expenses te
SET product_id = t.product_id,
    updated_at = NOW()
FROM tours t
WHERE te.tour_id = t.id
AND t.product_id IS NOT NULL
AND (
    te.product_id IS NULL 
    OR te.product_id NOT IN (SELECT id FROM products)
);

-- 3. 수정 후 상태 확인
SELECT 
    'After Update' as section,
    'Total tour_expenses records' as metric,
    COUNT(*) as value
FROM tour_expenses

UNION ALL

SELECT 
    'After Update',
    'Records with null product_id',
    COUNT(*)
FROM tour_expenses
WHERE product_id IS NULL

UNION ALL

SELECT 
    'After Update',
    'Records with invalid product_id',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL

UNION ALL

SELECT 
    'After Update',
    'Records with valid product_id',
    COUNT(*)
FROM tour_expenses te
JOIN products p ON te.product_id = p.id;

-- 4. 업데이트된 레코드 수 확인
SELECT 
    'Update Summary' as info,
    COUNT(*) as updated_records
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id
WHERE te.product_id = t.product_id
AND (
    te.updated_at >= NOW() - INTERVAL '1 minute'
    OR te.updated_at IS NULL
);

COMMIT;

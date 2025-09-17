-- Tour Expenses 데이터 분석 스크립트
-- 제외된 레코드의 원인을 파악하기 위한 분석

BEGIN;

-- 1. 현재 tour_expenses 테이블 상태 확인
SELECT 
    'Current tour_expenses count' as info,
    COUNT(*) as total_records
FROM tour_expenses;

-- 2. tours 테이블의 ID 개수 확인
SELECT 
    'Tours table count' as info,
    COUNT(*) as total_tours
FROM tours;

-- 3. products 테이블의 ID 개수 확인
SELECT 
    'Products table count' as info,
    COUNT(*) as total_products
FROM products;

-- 4. tour_expenses에서 유효하지 않은 tour_id 참조 분석
SELECT 
    'Invalid tour_id references' as issue,
    COUNT(*) as count,
    'These records would be filtered out during sync' as note
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

-- 5. tour_expenses에서 유효하지 않은 product_id 참조 분석
SELECT 
    'Invalid product_id references' as issue,
    COUNT(*) as count,
    'These records would be filtered out during sync' as note
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- 6. 샘플 유효하지 않은 tour_id들 확인
SELECT 
    'Sample invalid tour_ids' as info,
    te.tour_id,
    COUNT(*) as record_count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL
GROUP BY te.tour_id
ORDER BY record_count DESC
LIMIT 10;

-- 7. 샘플 유효하지 않은 product_id들 확인
SELECT 
    'Sample invalid product_ids' as info,
    te.product_id,
    COUNT(*) as record_count
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL
GROUP BY te.product_id
ORDER BY record_count DESC
LIMIT 10;

-- 8. 유효한 레코드 수 계산 (동기화에서 처리될 레코드)
SELECT 
    'Valid records for sync' as info,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
LEFT JOIN products p ON te.product_id = p.id
WHERE (te.tour_id IS NULL OR t.id IS NOT NULL)
AND (te.product_id IS NULL OR p.id IS NOT NULL);

-- 9. 제외될 레코드 수 계산
SELECT 
    'Records that would be excluded' as info,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
LEFT JOIN products p ON te.product_id = p.id
WHERE (te.tour_id IS NOT NULL AND t.id IS NULL)
OR (te.product_id IS NOT NULL AND p.id IS NULL);

COMMIT;

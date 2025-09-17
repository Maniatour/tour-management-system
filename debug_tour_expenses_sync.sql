-- Tour Expenses 동기화 문제 디버깅 스크립트
-- 제외되는 레코드의 정확한 원인을 파악하기 위한 분석

BEGIN;

-- 1. 현재 tour_expenses 테이블 상태
SELECT 
    'Current tour_expenses in DB' as info,
    COUNT(*) as total_records
FROM tour_expenses;

-- 2. 구글 시트에서 읽어온 데이터 수 (3676행)
-- 이는 동기화 로그에서 확인된 수치

-- 3. tours 테이블의 ID 개수 및 샘플
SELECT 
    'Tours table' as info,
    COUNT(*) as total_tours,
    'Sample IDs:' as sample_label,
    STRING_AGG(id::text, ', ' ORDER BY id) as sample_ids
FROM tours
LIMIT 10;

-- 4. products 테이블의 ID 개수 및 샘플
SELECT 
    'Products table' as info,
    COUNT(*) as total_products,
    'Sample IDs:' as sample_label,
    STRING_AGG(id::text, ', ' ORDER BY id) as sample_ids
FROM products
LIMIT 10;

-- 5. tour_expenses에서 유효하지 않은 tour_id 참조 상세 분석
SELECT 
    'Invalid tour_id analysis' as section,
    'Count' as metric,
    COUNT(*) as value
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL

UNION ALL

SELECT 
    'Invalid tour_id analysis',
    'Sample invalid tour_ids',
    COUNT(DISTINCT te.tour_id)
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

-- 6. 유효하지 않은 tour_id 샘플들
SELECT 
    'Sample invalid tour_ids' as info,
    te.tour_id,
    COUNT(*) as record_count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL
GROUP BY te.tour_id
ORDER BY record_count DESC
LIMIT 20;

-- 7. tour_expenses에서 유효하지 않은 product_id 참조 상세 분석
SELECT 
    'Invalid product_id analysis' as section,
    'Count' as metric,
    COUNT(*) as value
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL

UNION ALL

SELECT 
    'Invalid product_id analysis',
    'Sample invalid product_ids',
    COUNT(DISTINCT te.product_id)
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- 8. 유효하지 않은 product_id 샘플들
SELECT 
    'Sample invalid product_ids' as info,
    te.product_id,
    COUNT(*) as record_count
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL
GROUP BY te.product_id
ORDER BY record_count DESC
LIMIT 20;

-- 9. 동기화에서 처리될 유효한 레코드 수 계산
SELECT 
    'Valid records for sync' as info,
    COUNT(*) as count,
    'These would be processed by sync' as note
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
LEFT JOIN products p ON te.product_id = p.id
WHERE (te.tour_id IS NULL OR t.id IS NOT NULL)
AND (te.product_id IS NULL OR p.id IS NOT NULL);

-- 10. 제외될 레코드 수 계산 (이것이 3676 - 2060 = 1616개여야 함)
SELECT 
    'Records that would be excluded' as info,
    COUNT(*) as count,
    'These are filtered out during sync' as note
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
LEFT JOIN products p ON te.product_id = p.id
WHERE (te.tour_id IS NOT NULL AND t.id IS NULL)
OR (te.product_id IS NOT NULL AND p.id IS NULL);

-- 11. tour_id와 product_id가 모두 NULL인 레코드 수
SELECT 
    'Records with both tour_id and product_id NULL' as info,
    COUNT(*) as count
FROM tour_expenses
WHERE tour_id IS NULL AND product_id IS NULL;

-- 12. tour_id만 NULL인 레코드 수
SELECT 
    'Records with only tour_id NULL' as info,
    COUNT(*) as count
FROM tour_expenses te
JOIN products p ON te.product_id = p.id
WHERE te.tour_id IS NULL;

-- 13. product_id만 NULL인 레코드 수
SELECT 
    'Records with only product_id NULL' as info,
    COUNT(*) as count
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id
WHERE te.product_id IS NULL;

COMMIT;

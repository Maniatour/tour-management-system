-- Tour Expenses 동기화 문제 완전 해결
-- 모든 레코드가 동기화되도록 하는 포괄적인 해결책

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
    'Invalid tour_id references',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL

UNION ALL

SELECT 
    'Current Analysis',
    'Invalid product_id references',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- 2. 옵션 1: 누락된 tours 자동 생성
-- tour_id가 유효하지 않은 레코드들을 위한 기본 투어 생성
INSERT INTO tours (id, product_id, tour_date, tour_status, created_at, updated_at)
SELECT DISTINCT 
    te.tour_id,
    te.product_id,
    te.tour_date,
    'scheduled'::VARCHAR(50),
    COALESCE(te.created_at, NOW()),
    COALESCE(te.updated_at, NOW())
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL 
AND t.id IS NULL
AND te.tour_id NOT IN (SELECT id FROM tours)
ON CONFLICT (id) DO NOTHING;

-- 3. 옵션 2: 누락된 products 자동 생성
-- product_id가 유효하지 않은 레코드들을 위한 기본 상품 생성
INSERT INTO products (id, name, category, base_price, status, created_at, updated_at)
SELECT DISTINCT 
    te.product_id,
    'Unknown Product - ' || te.product_id,
    'Unknown',
    0.00,
    'active',
    COALESCE(te.created_at, NOW()),
    COALESCE(te.updated_at, NOW())
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL 
AND p.id IS NULL
AND te.product_id NOT IN (SELECT id FROM products)
ON CONFLICT (id) DO NOTHING;

-- 4. 수정 후 상태 확인
SELECT 
    'After Auto-Creation' as section,
    'Total tours' as metric,
    COUNT(*) as value
FROM tours

UNION ALL

SELECT 
    'After Auto-Creation',
    'Total products',
    COUNT(*)
FROM products

UNION ALL

SELECT 
    'After Auto-Creation',
    'Valid tour_id references',
    COUNT(*)
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id

UNION ALL

SELECT 
    'After Auto-Creation',
    'Valid product_id references',
    COUNT(*)
FROM tour_expenses te
JOIN products p ON te.product_id = p.id;

-- 5. 여전히 유효하지 않은 레코드가 있다면 NULL로 설정
-- tour_id가 여전히 유효하지 않은 경우
UPDATE tour_expenses 
SET tour_id = NULL 
WHERE tour_id IS NOT NULL 
AND tour_id NOT IN (SELECT id FROM tours);

-- product_id가 여전히 유효하지 않은 경우
UPDATE tour_expenses 
SET product_id = NULL 
WHERE product_id IS NOT NULL 
AND product_id NOT IN (SELECT id FROM products);

-- 6. 최종 상태 확인
SELECT 
    'Final Status' as section,
    'Total tour_expenses' as metric,
    COUNT(*) as value
FROM tour_expenses

UNION ALL

SELECT 
    'Final Status',
    'Records with valid tour_id',
    COUNT(*)
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id

UNION ALL

SELECT 
    'Final Status',
    'Records with valid product_id',
    COUNT(*)
FROM tour_expenses te
JOIN products p ON te.product_id = p.id

UNION ALL

SELECT 
    'Final Status',
    'Records with NULL tour_id',
    COUNT(*)
FROM tour_expenses 
WHERE tour_id IS NULL

UNION ALL

SELECT 
    'Final Status',
    'Records with NULL product_id',
    COUNT(*)
FROM tour_expenses 
WHERE product_id IS NULL

UNION ALL

SELECT 
    'Final Status',
    'Records ready for sync',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
LEFT JOIN products p ON te.product_id = p.id
WHERE (te.tour_id IS NULL OR t.id IS NOT NULL)
AND (te.product_id IS NULL OR p.id IS NOT NULL);

COMMIT;

-- 7. 동기화 재시도 안내
SELECT 
    'Next Steps' as info,
    'Now retry the sync - all 3676 records should be processed' as instruction;

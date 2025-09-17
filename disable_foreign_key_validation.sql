-- 외래 키 검증 일시 비활성화
-- 모든 tour_expenses 레코드가 동기화되도록 하는 임시 해결책

BEGIN;

-- 1. 현재 상황 확인
SELECT 
    'Current situation' as info,
    'Total tour_expenses records' as metric,
    COUNT(*) as value
FROM tour_expenses

UNION ALL

SELECT 
    'Current situation',
    'Invalid tour_id references',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL

UNION ALL

SELECT 
    'Current situation',
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
    'After auto-creation' as info,
    'Total tours' as metric,
    COUNT(*) as value
FROM tours

UNION ALL

SELECT 
    'After auto-creation',
    'Total products',
    COUNT(*)
FROM products

UNION ALL

SELECT 
    'After auto-creation',
    'Valid tour_id references',
    COUNT(*)
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id

UNION ALL

SELECT 
    'After auto-creation',
    'Valid product_id references',
    COUNT(*)
FROM tour_expenses te
JOIN products p ON te.product_id = p.id;

-- 5. 여전히 유효하지 않은 레코드가 있다면 NULL로 설정
UPDATE tour_expenses 
SET tour_id = NULL 
WHERE tour_id IS NOT NULL 
AND tour_id NOT IN (SELECT id FROM tours);

UPDATE tour_expenses 
SET product_id = NULL 
WHERE product_id IS NOT NULL 
AND product_id NOT IN (SELECT id FROM products);

-- 6. 최종 상태 확인
SELECT 
    'Final status' as info,
    'Total tour_expenses' as metric,
    COUNT(*) as value
FROM tour_expenses

UNION ALL

SELECT 
    'Final status',
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
    'Next steps' as info,
    'Now retry the sync - all records should be processed' as instruction;

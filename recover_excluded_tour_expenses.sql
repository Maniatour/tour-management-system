-- 제외된 tour_expenses 레코드 복구 옵션
-- 이 스크립트는 유효하지 않은 외래 키를 가진 레코드들을 처리하는 여러 옵션을 제공합니다

BEGIN;

-- 1. 현재 상황 분석
SELECT 
    'Analysis Summary' as section,
    'Total tour_expenses records' as metric,
    COUNT(*) as value
FROM tour_expenses
UNION ALL
SELECT 
    'Analysis Summary',
    'Invalid tour_id references',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT 
    'Analysis Summary',
    'Invalid product_id references',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;

-- 2. 옵션 1: 누락된 tours 생성 (tour_id가 없는 경우)
-- 이 옵션은 tour_id가 유효하지 않은 레코드들을 위한 기본 투어를 생성합니다
/*
INSERT INTO tours (id, product_id, tour_date, tour_status, created_at)
SELECT DISTINCT 
    te.tour_id,
    te.product_id,
    te.tour_date,
    'scheduled'::VARCHAR(50),
    NOW()
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL 
AND t.id IS NULL
AND te.tour_id NOT IN (SELECT id FROM tours);
*/

-- 3. 옵션 2: 누락된 products 생성 (product_id가 없는 경우)
-- 이 옵션은 product_id가 유효하지 않은 레코드들을 위한 기본 상품을 생성합니다
/*
INSERT INTO products (id, name, created_at)
SELECT DISTINCT 
    te.product_id,
    'Unknown Product - ' || te.product_id,
    NOW()
FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL 
AND p.id IS NULL
AND te.product_id NOT IN (SELECT id FROM products);
*/

-- 4. 옵션 3: 외래 키 제약 조건을 일시적으로 비활성화
-- 이 옵션은 모든 레코드를 동기화한 후 나중에 정리할 수 있게 합니다
/*
-- 외래 키 제약 조건 일시 비활성화
ALTER TABLE tour_expenses DROP CONSTRAINT IF EXISTS tour_expenses_tour_id_fkey;
ALTER TABLE tour_expenses DROP CONSTRAINT IF EXISTS tour_expenses_product_id_fkey;

-- 동기화 후 다시 추가
-- ALTER TABLE tour_expenses ADD CONSTRAINT tour_expenses_tour_id_fkey 
--     FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE;
-- ALTER TABLE tour_expenses ADD CONSTRAINT tour_expenses_product_id_fkey 
--     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
*/

-- 5. 옵션 4: 유효하지 않은 외래 키를 NULL로 설정 (안전한 방법)
-- 이 옵션은 데이터를 보존하면서 외래 키 제약 조건을 만족시킵니다

-- tour_id를 NULL로 설정 (이미 nullable로 변경됨)
UPDATE tour_expenses 
SET tour_id = NULL 
WHERE tour_id IS NOT NULL 
AND tour_id NOT IN (SELECT id FROM tours);

-- product_id를 NULL로 설정 (이미 nullable)
UPDATE tour_expenses 
SET product_id = NULL 
WHERE product_id IS NOT NULL 
AND product_id NOT IN (SELECT id FROM products);

-- 6. 수정 후 상태 확인
SELECT 
    'After fix - Total records' as status,
    COUNT(*) as count
FROM tour_expenses
UNION ALL
SELECT 
    'After fix - Records with valid tour_id',
    COUNT(*)
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id
UNION ALL
SELECT 
    'After fix - Records with valid product_id',
    COUNT(*)
FROM tour_expenses te
JOIN products p ON te.product_id = p.id
UNION ALL
SELECT 
    'After fix - Records with NULL tour_id',
    COUNT(*)
FROM tour_expenses 
WHERE tour_id IS NULL
UNION ALL
SELECT 
    'After fix - Records with NULL product_id',
    COUNT(*)
FROM tour_expenses 
WHERE product_id IS NULL;

COMMIT;

-- 7. 동기화 재시도 안내
SELECT 
    'Next Steps' as info,
    'Now you can retry the sync - all records should be processed' as instruction;

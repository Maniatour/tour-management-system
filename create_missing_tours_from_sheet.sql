-- 구글 시트의 tour_id들을 위한 기본 투어 생성
-- 이 스크립트는 구글 시트에서 사용되는 tour_id들을 tours 테이블에 생성합니다

BEGIN;

-- 1. 구글 시트에서 사용되는 tour_id들 확인 (tour_expenses에서 추출)
WITH sheet_tour_ids AS (
  SELECT DISTINCT tour_id
  FROM tour_expenses
  WHERE tour_id LIKE 'OE%'  -- OE로 시작하는 ID들
  AND tour_id NOT IN (SELECT id FROM tours)
)
SELECT 
    'Sheet tour_ids to create' as info,
    COUNT(*) as count,
    STRING_AGG(tour_id, ', ' ORDER BY tour_id) as sample_ids
FROM sheet_tour_ids;

-- 2. 누락된 tours 생성
INSERT INTO tours (id, product_id, tour_date, tour_status, created_at, updated_at)
SELECT DISTINCT 
    te.tour_id,
    te.product_id,
    te.tour_date,
    'scheduled'::VARCHAR(50),
    COALESCE(te.created_at, NOW()),
    COALESCE(te.updated_at, NOW())
FROM tour_expenses te
WHERE te.tour_id LIKE 'OE%'  -- OE로 시작하는 ID들
AND te.tour_id NOT IN (SELECT id FROM tours)
ON CONFLICT (id) DO NOTHING;

-- 3. 누락된 products 생성 (pgg1 등)
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
WHERE te.product_id IS NOT NULL 
AND te.product_id NOT IN (SELECT id FROM products)
ON CONFLICT (id) DO NOTHING;

-- 4. 생성 후 상태 확인
SELECT 
    'After creation' as info,
    'Total tours' as metric,
    COUNT(*) as value
FROM tours

UNION ALL

SELECT 
    'After creation',
    'Total products',
    COUNT(*)
FROM products

UNION ALL

SELECT 
    'After creation',
    'Valid tour_id references',
    COUNT(*)
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id

UNION ALL

SELECT 
    'After creation',
    'Valid product_id references',
    COUNT(*)
FROM tour_expenses te
JOIN products p ON te.product_id = p.id

UNION ALL

SELECT 
    'After creation',
    'Records ready for sync',
    COUNT(*)
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
LEFT JOIN products p ON te.product_id = p.id
WHERE (te.tour_id IS NULL OR t.id IS NOT NULL)
AND (te.product_id IS NULL OR p.id IS NOT NULL);

COMMIT;

-- 5. 동기화 재시도 안내
SELECT 
    'Next steps' as info,
    'Now retry the sync - all records should be processed' as instruction;

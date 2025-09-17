-- 실제 tour 데이터 확인
-- tours 테이블에 실제로 어떤 ID들이 있는지 확인

-- 1. tours 테이블의 실제 ID들 확인
SELECT 
    'Actual tours in database' as info,
    id,
    LENGTH(id) as id_length,
    tour_date,
    tour_status,
    created_at
FROM tours
ORDER BY created_at DESC
LIMIT 20;

-- 2. tour_expenses에서 자주 사용되는 tour_id들 확인
SELECT 
    'Most common tour_ids in tour_expenses' as info,
    tour_id,
    LENGTH(tour_id) as id_length,
    COUNT(*) as usage_count
FROM tour_expenses
WHERE tour_id IS NOT NULL
GROUP BY tour_id
ORDER BY usage_count DESC
LIMIT 20;

-- 3. 로그에서 보이는 특정 tour_id들이 실제로 존재하는지 확인
WITH test_ids AS (
  SELECT unnest(ARRAY[
    'b712f7e0', 'f022894c', 'E766416c3', 'f30859db', 'bbe70770',
    'c127f364', 'E3b085692', 'dd91e79f', 'OE3954', 'fe536c07'
  ]) AS test_id
)
SELECT 
    'Test specific tour_ids' as info,
    t.test_id,
    CASE 
        WHEN tr.id IS NOT NULL THEN 'EXISTS'
        ELSE 'NOT FOUND'
    END as status,
    tr.tour_date,
    tr.tour_status
FROM test_ids t
LEFT JOIN tours tr ON t.test_id = tr.id
ORDER BY t.test_id;

-- 4. tours 테이블의 총 개수
SELECT 
    'Tours table count' as info,
    COUNT(*) as total_tours
FROM tours;

-- 5. tour_expenses 테이블의 총 개수
SELECT 
    'Tour_expenses table count' as info,
    COUNT(*) as total_tour_expenses
FROM tour_expenses;

-- 6. 유효한 tour_id 참조 수
SELECT 
    'Valid tour_id references' as info,
    COUNT(*) as valid_references
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id;

-- 7. 유효하지 않은 tour_id 참조 수
SELECT 
    'Invalid tour_id references' as info,
    COUNT(*) as invalid_references
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

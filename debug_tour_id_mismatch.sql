-- Tour ID 불일치 문제 진단
-- 로그에서 보이는 tour_id들이 실제로 tours 테이블에 있는지 확인

BEGIN;

-- 1. 로그에서 보이는 샘플 tour_id들이 실제로 존재하는지 확인
WITH sample_tour_ids AS (
  SELECT unnest(ARRAY[
    'b712f7e0', 'f022894c', 'E766416c3', 'f30859db', 'bbe70770', 
    'c127f364', 'E3b085692', 'dd91e79f', 'OE3954', 'fe536c07',
    'E1e49339d', 'b4b2bf38', 'e88581af', 'ed9c75a7', 'bebe3e16',
    'e15f3dfc', 'e81fe011', 'dbc74518', 'd0b1cd95', 'e8864087'
  ]) AS tour_id
)
SELECT 
    'Sample tour_id check' as test_type,
    s.tour_id,
    CASE 
        WHEN t.id IS NOT NULL THEN 'EXISTS'
        ELSE 'NOT FOUND'
    END as status,
    t.tour_date,
    t.tour_status
FROM sample_tour_ids s
LEFT JOIN tours t ON s.tour_id = t.id
ORDER BY s.tour_id;

-- 2. tours 테이블의 ID 형식 확인
SELECT 
    'Tours table ID format analysis' as info,
    COUNT(*) as total_tours,
    'Sample IDs:' as sample_label,
    STRING_AGG(id::text, ', ' ORDER BY id) as sample_ids
FROM tours
LIMIT 20;

-- 3. tour_expenses 테이블의 tour_id 형식 확인
SELECT 
    'Tour_expenses tour_id format analysis' as info,
    COUNT(*) as total_records,
    'Sample tour_ids:' as sample_label,
    STRING_AGG(DISTINCT tour_id, ', ' ORDER BY tour_id) as sample_tour_ids
FROM tour_expenses
WHERE tour_id IS NOT NULL
LIMIT 20;

-- 4. ID 형식 불일치 확인 (UUID vs TEXT)
SELECT 
    'ID format mismatch check' as info,
    'Tours table ID type' as table_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'tours' AND column_name = 'id'

UNION ALL

SELECT 
    'ID format mismatch check',
    'Tour_expenses tour_id type',
    data_type
FROM information_schema.columns 
WHERE table_name = 'tour_expenses' AND column_name = 'tour_id';

-- 5. 실제 존재하지 않는 tour_id들 확인
SELECT 
    'Non-existent tour_ids in tour_expenses' as info,
    COUNT(*) as count,
    'These are the ones being filtered out' as note
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

-- 6. 샘플 존재하지 않는 tour_id들
SELECT 
    'Sample non-existent tour_ids' as info,
    te.tour_id,
    COUNT(*) as record_count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL
GROUP BY te.tour_id
ORDER BY record_count DESC
LIMIT 20;

-- 7. ID 길이 분석
SELECT 
    'ID length analysis' as info,
    'Tours table' as source,
    LENGTH(id::text) as id_length,
    COUNT(*) as count
FROM tours
GROUP BY LENGTH(id::text)
ORDER BY id_length

UNION ALL

SELECT 
    'ID length analysis',
    'Tour_expenses tour_id',
    LENGTH(tour_id),
    COUNT(*)
FROM tour_expenses
WHERE tour_id IS NOT NULL
GROUP BY LENGTH(tour_id)
ORDER BY id_length;

COMMIT;

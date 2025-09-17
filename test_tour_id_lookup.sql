-- Tour ID 조회 테스트
-- 로그에서 보이는 특정 tour_id들이 실제로 존재하는지 확인

-- 1. 로그에서 자주 보이는 tour_id들 확인
SELECT 
    'Direct lookup test' as test,
    'b712f7e0' as tour_id,
    CASE WHEN EXISTS(SELECT 1 FROM tours WHERE id = 'b712f7e0') THEN 'FOUND' ELSE 'NOT FOUND' END as status
UNION ALL
SELECT 
    'Direct lookup test',
    'f022894c',
    CASE WHEN EXISTS(SELECT 1 FROM tours WHERE id = 'f022894c') THEN 'FOUND' ELSE 'NOT FOUND' END
UNION ALL
SELECT 
    'Direct lookup test',
    'E766416c3',
    CASE WHEN EXISTS(SELECT 1 FROM tours WHERE id = 'E766416c3') THEN 'FOUND' ELSE 'NOT FOUND' END
UNION ALL
SELECT 
    'Direct lookup test',
    'f30859db',
    CASE WHEN EXISTS(SELECT 1 FROM tours WHERE id = 'f30859db') THEN 'FOUND' ELSE 'NOT FOUND' END
UNION ALL
SELECT 
    'Direct lookup test',
    'bbe70770',
    CASE WHEN EXISTS(SELECT 1 FROM tours WHERE id = 'bbe70770') THEN 'FOUND' ELSE 'NOT FOUND' END;

-- 2. tours 테이블의 실제 ID들 확인
SELECT 
    'Actual tour IDs in database' as info,
    id,
    tour_date,
    tour_status
FROM tours
ORDER BY created_at DESC
LIMIT 10;

-- 3. tour_expenses에서 유효한 tour_id 참조 확인
SELECT 
    'Valid tour_id references' as info,
    COUNT(*) as count
FROM tour_expenses te
JOIN tours t ON te.tour_id = t.id;

-- 4. tour_expenses에서 유효하지 않은 tour_id 참조 확인
SELECT 
    'Invalid tour_id references' as info,
    COUNT(*) as count
FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

-- 5. ID 형식 비교
SELECT 
    'ID format comparison' as info,
    'tours.id' as column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'tours' AND column_name = 'id'
UNION ALL
SELECT 
    'ID format comparison',
    'tour_expenses.tour_id',
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'tour_expenses' AND column_name = 'tour_id';

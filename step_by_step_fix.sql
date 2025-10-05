-- 단계별 문제 해결 가이드

-- STEP 1: 현재 상태 확인
SELECT 
    COUNT(*) as total_products,
    COUNT(tour_departure_times) as non_null_times,
    COUNT(CASE WHEN tour_departure_times IS NULL THEN 1 END) as null_times
FROM products;

-- STEP 2: 문제가 있는 데이터 확인
SELECT 
    id,
    tour_departure_times,
    jsonb_typeof(tour_departure_times) as data_type,
    CASE 
        WHEN tour_departure_times IS NOT NULL 
        THEN jsonb_array_length(tour_departure_times) 
        ELSE NULL 
    END as array_length
FROM products 
WHERE tour_departure_times IS NOT NULL 
AND (
    jsonb_typeof(tour_departure_times) != 'array'
    OR jsonb_array_length(tour_departure_times) > 10
);

-- STEP 3: 제약조건 임시 제거
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_tour_departure_times_format;

-- STEP 4: 문제 데이터 수정
-- NULL 값들을 빈 배열로 설정
UPDATE products 
SET tour_departure_times = '[]'::jsonb 
WHERE tour_departure_times IS NULL;

-- 문자열 형태의 데이터를 배열로 변환 (만약 있다면)
UPDATE products 
SET tour_departure_times = jsonb_build_array(tour_departure_times::text)
WHERE tour_departure_times IS NOT NULL 
AND jsonb_typeof(tour_departure_times) = 'string';

-- STEP 5: 다시 안된 조건 추가 (단계적으로)
-- 먼저 기본적인 배열 조건만 추가
ALTER TABLE products 
ADD CONSTRAINT check_tour_departure_times_basic 
CHECK (
    tour_departure_times IS NULL 
    OR jsonb_typeof(tour_departure_times) = 'array'
);

-- STEP 6: 길이 제한 추가
ALTER TABLE products 
ADD CONSTRAINT check_tour_depatture_times_length 
CHECK (
    tour_departure_times IS NULL 
    OR jsonb_array_length(tour_departure_times) BETWEEN 0 AND 10
);

-- STEP 7: 마지막으로 완전한 제약조건 교체
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_tour_departure_times_basic;
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_tour_departure_times_length;

ALTER TABLE products 
ADD CONSTRAINT check_tour_departure_times_format 
CHECK (
    tour_departure_times IS NULL 
    OR (
        jsonb_typeof(tour_departure_times) = 'array'
        AND jsonb_array_length(tour_departure_times) BETWEEN 0 AND 10
        AND NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(tour_departure_times) AS elem
            WHERE jsonb_typeof(elem) != 'string'
        )
    )
);

-- STEP 8: 최종 확인
SELECT '제약조건 추가 완료!' as status;

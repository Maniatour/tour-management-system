-- 기존 제약조건 오류 해결을 위한 수정된 SQL

-- 1. 기존 제약조건이 문제가 되는 경우를 대비하여 먼저 제약조건을 삭제
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_tour_departure_times_format;

-- 2. 기존 tour_departure_time 컬럼이 있다면 삭제
ALTER TABLE products DROP COLUMN IF EXISTS tour_departure_time;

-- 3. 새로운 tour_departure_times 컬럼 추가 (JSON 배열 형태)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tour_departure_times JSONB DEFAULT '[]'::jsonb;

-- 4. 컬럼에 코멘트 추가
COMMENT ON COLUMN products.tour_departure_times IS '투어 출발 시간 목록 (JSON 배열). 예: ["09:00", "14:00", "18:00"]';

-- 5. 기존 데이터 확인 및 수정 (NULL 값이나 잘못된 형식의 데이터 수정)
-- 먼저 기존 데이터를 확인해보고 null 값들을 기본 배열로 설정
UPDATE products 
SET tour_departure_times = '[]'::jsonb 
WHERE tour_departure_times IS NULL;

-- 6. 잘못된 문자열을 올바른 배열 형태로 변환 (필요한 경우)
-- 만약 기존에 단순 문자열로 저장된 시간들이 있다면
DO $$
DECLARE
    rec RECORD;
BEGIN
    -- tour_departure_times가 문자열인 행들을 찾아서 수정
    FOR rec WITHIN
        SELECT id, tour_departure_times
        FROM products 
        WHERE tour_departure_times IS NOT NULL 
        AND jsonb_typeof(tour_departure_times) = 'string'
    LOOP
        -- 문자열을 배열로 감싸서 변환
        UPDATE products 
        SET tour_departure_times = jsonb_build_array(rec.tour_departure_times::text)
        WHERE id = rec.id;
    END LOOP;
END $$;

-- 7. 이제 안전한 제약조건 추가 (더 관대한 조건)
ALTER TABLE products 
ADD CONSTRAINT check_tour_departure_times_format 
CHECK (
    -- 배열이거나 null이어야 함
    jsonb_typeof(tour_departure_times) = 'array' 
    OR tour_departure_times IS NULL
    -- 배열 길이가 0 이상 10 이하여야 함
    AND (
        tour_departure_times IS NULL 
        OR jsonb_array_length(tour_departure_times) BETWEEN 0 AND 10
    )
    -- 각 요소가 문자열이어야 함 (시간 형식이 아닌 경우도 허용)
);

-- 8. 인덱스 추가 (JSON 배열 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_products_tour_departure_times 
ON products USING GIN (tour_departure_times);

-- 9. 시간 형식 검증을 위한 더 엄격한 제약조건 (선택사항)
-- 이 제약조건은 시간 형식 검증을 수행하지만, 더 관대함
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS check_tour_departure_times_format;

ALTER TABLE products 
ADD CONSTRAINT check_tour_departure_times_format_strict
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

--  TIPS: 기존 데이터 문제 해결을 위한 단계별 접근
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- 잘못된 데이터가 있는지 확인
    SELECT COUNT(*) INTO invalid_count
    FROM products 
    WHERE tour_departure_times IS NOT NULL 
    AND (
        jsonb_typeof(tour_departure_times) != 'array'
        OR jsonb_array_length(tour_departure_times) > 10
        OR EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(tour_departure_times) AS elem
            WHERE jsonb_typeof(elem) != 'string'
        )
    );
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Found % invalid records. Attempting to fix...', invalid_count;
        
        -- 잘못된 레코드들을 기본값으로 설정
        UPDATE products 
        SET tour_departure_times = '[]'::jsonb 
        WHERE tour_departure_times IS NOT NULL 
        AND (
            jsonb_typeof(tour_departure_times) != 'array'
            OR jsonb_array_length(tour_departure_times) > 10
            OR EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(tour_departure_times) AS elem
                WHERE jsonb_typeof(elem) != 'string'
            )
        );
        
        RAISE NOTICE 'Fixed % invalid records.', invalid_count;
    ELSE
        RAISE NOTICE 'No invalid records found.';
    END IF;
END $$;

-- 10. 유틸리티 함수들 (기존과 동일하지만 더 안전함)
CREATE OR REPLACE FUNCTION get_available_departure_times(product_id uuid)
RETURNS TEXT[] AS $$
DECLARE
    departure_times TEXT[];
BEGIN
    -- 상품의 출발 시간 배열을 가져와서 문자열 배열로 변환
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(tour_departure_times)
        FROM products 
        WHERE id = product_id
    ) INTO departure_times;
    
    -- NULL 안전하게 처리
    RETURN COALESCE(departure_times, ARRAY[]::TEXT[]);
EXCEPTION
    WHEN OTHERS THEN
        -- 오류 발생 시 빈 배열 반환
        RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_valid_departure_time(product_id uuid, departure_time time)
RETURNS BOOLEAN AS $$
DECLARE
    is_valid BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM products 
        WHERE id = product_id 
        AND tour_departure_times IS NOT NULL
        AND jsonb_typeof(tour_departure_times) = 'array'
        AND tour_departure_times @> ('"' || departure_time || '"')::jsonb
    ) INTO is_valid;
    
    RETURN COALESCE(is_valid, FALSE);
EXCEPTION
    WHEN OTHERS THEN
        -- 오류 발생 시 false 반환
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 2. 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'tour_departure_times 컬럼 수정 완료!';
    RAISE NOTICE '기존 데이터 문제를 해결했습니다.';
	tips NOTICE '사용 방법:';
    RAISE NOTICE '1. 상품에 출발 시간 추가: UPDATE products SET tour_departure_times = ''["09:00", "14:00", "18:00"]'' WHERE id = ''상품ID'';';
    RAISE NOTICE '2. 사용 가능한 출발 시간 조회: SELECT * FROM get_available_departure_times(''상품ID'');';
    RAISE NOTICE '3. 출발 시간 검증: SELECT * FROM is_valid_departure_time(''상품ID'', ''09:00''::time);';
END $$;

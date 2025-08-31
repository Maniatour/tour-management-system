-- language 컬럼의 배열 형태 데이터를 문자열로 변환하고 재발 방지
-- 2025-01-01 00:00:39

-- 1. 기존 데이터 백업
CREATE TABLE IF NOT EXISTS customers_backup_v7 AS
SELECT * FROM customers;

-- 2. 현재 데이터 상태 확인 및 로깅
DO $$
DECLARE
    array_count INTEGER;
    string_count INTEGER;
    null_count INTEGER;
BEGIN
    -- 배열 형태 데이터 개수 확인
    SELECT COUNT(*) INTO array_count 
    FROM customers 
    WHERE language IS NOT NULL AND language LIKE '[%]';
    
    -- 문자열 형태 데이터 개수 확인
    SELECT COUNT(*) INTO string_count 
    FROM customers 
    WHERE language IS NOT NULL AND language NOT LIKE '[%]';
    
    -- NULL 데이터 개수 확인
    SELECT COUNT(*) INTO null_count 
    FROM customers 
    WHERE language IS NULL;
    
    RAISE NOTICE '변환 전 - 배열: %, 문자열: %, NULL: %', array_count, string_count, null_count;
END $$;

-- 3. 배열 형태 데이터를 문자열로 변환 (강제 변환)
UPDATE customers 
SET language = CASE 
    WHEN language = '["KR"]' THEN 'KR'
    WHEN language = '["EN"]' THEN 'EN'
    WHEN language = '["ko"]' THEN 'ko'
    WHEN language = '["en"]' THEN 'en'
    WHEN language = '["한국어"]' THEN 'ko'
    WHEN language = '["영어"]' THEN 'en'
    WHEN language LIKE '[%]' AND language LIKE '%]' THEN
        -- JSON 배열 형태 제거하고 첫 번째 값만 추출
        TRIM(BOTH '[]' FROM language)
    ELSE language
END
WHERE language IS NOT NULL 
    AND (language LIKE '[%]' OR language IN ('["KR"]', '["EN"]', '["ko"]', '["en"]', '["한국어"]', '["영어"]'));

-- 4. 변환 후 데이터 정리
-- 빈 문자열이나 공백만 있는 경우 NULL로 설정
UPDATE customers 
SET language = NULL 
WHERE language IS NOT NULL AND TRIM(language) = '';

-- 5. 변환 결과 확인 및 로깅
DO $$
DECLARE
    array_count_after INTEGER;
    string_count_after INTEGER;
    null_count_after INTEGER;
BEGIN
    -- 배열 형태 데이터 개수 확인
    SELECT COUNT(*) INTO array_count_after 
    FROM customers 
    WHERE language IS NOT NULL AND language LIKE '[%]';
    
    -- 문자열 형태 데이터 개수 확인
    SELECT COUNT(*) INTO string_count_after 
    FROM customers 
    WHERE language IS NOT NULL AND language NOT LIKE '[%]';
    
    -- NULL 데이터 개수 확인
    SELECT COUNT(*) INTO null_count_after 
    FROM customers 
    WHERE language IS NULL;
    
    RAISE NOTICE '변환 후 - 배열: %, 문자열: %, NULL: %', array_count_after, string_count_after, null_count_after;
    
    -- 배열 데이터가 남아있다면 경고
    IF array_count_after > 0 THEN
        RAISE WARNING '여전히 배열 형태의 데이터가 %개 남아있습니다!', array_count_after;
    END IF;
END $$;

-- 6. 최종 검증 쿼리 (실행 후 확인용)
-- SELECT DISTINCT language, COUNT(*) FROM customers GROUP BY language ORDER BY language;

-- 7. 재발 방지를 위한 제약 조건 추가
-- language 컬럼에 배열 형태 데이터가 들어가지 않도록 체크 제약 조건 추가
ALTER TABLE customers ADD CONSTRAINT check_language_not_array 
CHECK (language IS NULL OR language NOT LIKE '[%]');

-- 8. 제약 조건 확인
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_language_not_array' 
        AND table_name = 'customers'
    ) THEN
        RAISE NOTICE '배열 방지 제약 조건이 성공적으로 추가되었습니다.';
    ELSE
        RAISE WARNING '배열 방지 제약 조건 추가에 실패했습니다.';
    END IF;
END $$;

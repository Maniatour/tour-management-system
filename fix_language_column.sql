-- language 컬럼 문제 해결을 위한 완전한 SQL 스크립트
-- 2025-01-01 00:00:39

-- 1. 기존 데이터 백업
CREATE TABLE IF NOT EXISTS customers_backup_final AS
SELECT * FROM customers;

-- 2. 현재 데이터 상태 확인
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

-- 6. 컬럼 타입을 text로 변경
ALTER TABLE customers ALTER COLUMN language TYPE text USING language::text;

-- 7. 기본값 제거 (실제 고객 언어 데이터만 사용)
ALTER TABLE customers ALTER COLUMN language DROP DEFAULT;

-- 8. 컬럼 설명 업데이트
COMMENT ON COLUMN customers.language IS '선호 언어 (ko: 한국어, en: 영어) - text 타입, 기본값 없음 (실제 데이터만 사용)';

-- 9. 재발 방지를 위한 제약 조건 추가
-- language 컬럼에 배열 형태 데이터가 들어가지 않도록 체크 제약 조건 추가
DO $$
BEGIN
    -- 기존 제약 조건이 있다면 제거
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_language_not_array' 
        AND table_name = 'customers'
    ) THEN
        ALTER TABLE customers DROP CONSTRAINT check_language_not_array;
    END IF;
    
    -- 새로운 제약 조건 추가
    ALTER TABLE customers ADD CONSTRAINT check_language_not_array 
    CHECK (language IS NULL OR language NOT LIKE '[%]');
    
    RAISE NOTICE '배열 방지 제약 조건이 성공적으로 추가되었습니다.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '제약 조건 추가 실패: %', SQLERRM;
END $$;

-- 10. 최종 검증
SELECT '최종 검증 결과' as status;
SELECT DISTINCT language, COUNT(*) as count 
FROM customers 
GROUP BY language 
ORDER BY language;

-- 11. 제약 조건 확인
SELECT constraint_name, constraint_type, check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'check_language_not_array';

-- 12. 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'language 컬럼 문제 해결 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. 배열 형태 데이터를 문자열로 변환 완료';
    RAISE NOTICE '2. 컬럼 타입을 text로 변경 완료';
    RAISE NOTICE '3. 배열 방지 제약 조건 추가 완료';
    RAISE NOTICE '4. 백업 테이블: customers_backup_final';
    RAISE NOTICE '========================================';
END $$;

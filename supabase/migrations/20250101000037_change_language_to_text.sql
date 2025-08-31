-- language 컬럼을 varchar에서 text로 변경하고 기존 데이터 변환
-- 2025-01-01 00:00:37

-- 1. 기존 데이터 백업
CREATE TABLE IF NOT EXISTS customers_backup_v5 AS 
SELECT * FROM customers;

-- 2. language 컬럼의 기본값 제거 (변경 전에 필요)
ALTER TABLE customers ALTER COLUMN language DROP DEFAULT;

-- 3. language 컬럼 타입을 text로 변경
-- 먼저 배열 형태의 데이터를 문자열로 변환
UPDATE customers 
SET language = CASE 
  WHEN language LIKE '[%]' AND language LIKE '%]' THEN 
    -- JSON 배열 형태 제거하고 첫 번째 값만 추출
    TRIM(BOTH '[]' FROM language)
  WHEN language IS NULL THEN NULL
  ELSE language
END
WHERE language IS NOT NULL;

-- 그 다음 컬럼 타입을 text로 변경
ALTER TABLE customers ALTER COLUMN language TYPE text USING language::text;

-- 4. 기본값 제거 (실제 고객 언어 데이터만 사용)
ALTER TABLE customers ALTER COLUMN language DROP DEFAULT;

-- 5. 컬럼 설명 업데이트
COMMENT ON COLUMN customers.language IS '선호 언어 (ko: 한국어, en: 영어) - text 타입, 기본값 없음 (실제 데이터만 사용)';

-- 6. 기존 데이터 검증 및 정리
-- 배열 형태의 데이터를 문자열로 변환 (예: ["EN"] -> "EN")
UPDATE customers 
SET language = CASE 
  WHEN language LIKE '[%]' AND language LIKE '%]' THEN 
    -- JSON 배열 형태 제거하고 첫 번째 값만 추출
    TRIM(BOTH '[]' FROM language)
  WHEN language IS NULL THEN NULL
  ELSE language
END
WHERE language IS NOT NULL;

-- 7. 데이터 정리 후 검증
-- 빈 문자열이나 공백만 있는 경우 NULL로 설정 (기본값 강제 적용 방지)
UPDATE customers 
SET language = NULL 
WHERE language IS NULL OR TRIM(language) = '';

-- 8. 최종 검증 쿼리 (실행 후 확인용)
-- SELECT DISTINCT language, COUNT(*) FROM customers GROUP BY language ORDER BY language;

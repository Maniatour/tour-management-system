-- language 컬럼의 배열 형태 데이터를 문자열로 변환
-- 2025-01-01 00:00:38

-- 1. 기존 데이터 백업
CREATE TABLE IF NOT EXISTS customers_backup_v6 AS
SELECT * FROM customers;

-- 2. 배열 형태 데이터 변환
-- ["KR"] -> KR, ["EN"] -> EN 형태로 변환
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
WHERE language IS NOT NULL;

-- 3. 변환 결과 확인 (실행 후 확인용)
-- SELECT DISTINCT language, COUNT(*) FROM customers GROUP BY language ORDER BY language;

-- 4. 최종 정리: 빈 문자열이나 공백만 있는 경우 NULL로 설정
UPDATE customers
SET language = NULL
WHERE language IS NULL OR TRIM(language) = '';

-- 5. 최종 검증 (실행 후 확인용)
-- SELECT DISTINCT language, COUNT(*) FROM customers GROUP BY language ORDER BY language;

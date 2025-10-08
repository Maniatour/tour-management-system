-- 내부명 컬럼 삭제 스크립트
-- 상품명 필드를 정리하기 위해 내부명 관련 컬럼들을 삭제합니다.

-- 1. products 테이블에서 내부명 컬럼들 삭제
ALTER TABLE products DROP COLUMN IF EXISTS internal_name_ko;
ALTER TABLE products DROP COLUMN IF EXISTS internal_name_en;

-- 2. 삭제 완료 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('internal_name_ko', 'internal_name_en', 'customer_name_ko', 'customer_name_en')
ORDER BY column_name;

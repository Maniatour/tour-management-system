-- product_details_multilingual 테이블에 tags 컬럼 추가
ALTER TABLE product_details_multilingual 
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- product_details_common_multilingual 테이블에도 tags 컬럼 추가
ALTER TABLE product_details_common_multilingual 
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN product_details_multilingual.tags IS '상품 태그 (언어별)';
COMMENT ON COLUMN product_details_common_multilingual.tags IS '공통 상품 태그 (언어별)';

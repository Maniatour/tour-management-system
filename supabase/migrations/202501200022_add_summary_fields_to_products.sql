-- 상품 테이블에 요약 필드 추가 (한국어, 영어)
-- Migration: Add summary fields to products table

-- 한국어 요약 필드 추가
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS summary_ko TEXT;

-- 영어 요약 필드 추가  
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS summary_en TEXT;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN products.summary_ko IS '상품 요약 (한국어)';
COMMENT ON COLUMN products.summary_en IS '상품 요약 (영어)';

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_products_summary_ko ON products(summary_ko);
CREATE INDEX IF NOT EXISTS idx_products_summary_en ON products(summary_en);

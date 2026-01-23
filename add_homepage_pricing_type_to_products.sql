-- products 테이블에 홈페이지 가격 타입 필드 추가
-- 자체 채널 홈페이지에서 단일 가격 또는 성인/아동/유아 분리 가격 선택 가능

ALTER TABLE products
ADD COLUMN IF NOT EXISTS homepage_pricing_type VARCHAR(20) DEFAULT 'separate';

-- 코멘트 추가
COMMENT ON COLUMN products.homepage_pricing_type IS '홈페이지 가격 타입: single (단일 가격), separate (성인/아동/유아 분리 가격)';

-- 기본값 설정: 기존 데이터는 separate로 설정
UPDATE products
SET homepage_pricing_type = 'separate'
WHERE homepage_pricing_type IS NULL;

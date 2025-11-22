-- products 테이블에 즐겨찾기 기능 추가
-- is_favorite: 즐겨찾기 여부
-- favorite_order: 즐겨찾기 순서 (낮을수록 먼저 표시)

-- 1. is_favorite 컬럼 추가
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- 2. favorite_order 컬럼 추가
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS favorite_order INTEGER;

-- 3. 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN products.is_favorite IS '홈페이지에 즐겨찾기로 표시할지 여부';
COMMENT ON COLUMN products.favorite_order IS '홈페이지에서 즐겨찾기 상품의 표시 순서 (낮을수록 먼저 표시)';

-- 4. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_products_is_favorite ON products(is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_products_favorite_order ON products(favorite_order) WHERE is_favorite = true;





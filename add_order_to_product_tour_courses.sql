-- product_tour_courses 테이블에 순서(order) 필드 추가
ALTER TABLE product_tour_courses 
ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- 인덱스 생성 (순서 정렬 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_tour_courses_order ON product_tour_courses(product_id, "order");

-- 코멘트 추가
COMMENT ON COLUMN product_tour_courses."order" IS '상품 내 투어 코스의 표시 순서';

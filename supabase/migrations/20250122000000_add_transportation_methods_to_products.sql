-- 상품 테이블에 운송수단 컬럼 추가
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS transportation_methods TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 운송수단 허용 값 체크 제약조건 (선택사항)
-- 주석 처리: 배열 요소별 체크는 복잡하므로 애플리케이션 레벨에서 검증
-- CREATE CONSTRAINT check_valid_transportation_methods
-- CHECK (
--   transportation_methods <@ ARRAY['minivan', 'bus', 'helicopter', 'light_aircraft', 'limousine', 'van', 'car', 'suv']::TEXT[]
-- );

-- 인덱스 생성 (배열 컬럼 검색용)
CREATE INDEX IF NOT EXISTS idx_products_transportation_methods 
ON products USING GIN (transportation_methods);

-- 코멘트 추가
COMMENT ON COLUMN products.transportation_methods IS '상품에서 사용하는 운송수단 목록. 가능한 값: minivan, bus, helicopter, light_aircraft, limousine, van, car, suv';


-- 빠른 문제 해결 (기존 제약조건 제거만)

-- 기존 제약조건 제거
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_tour_departure_times_format;

-- 기존 컬럼 정리 (필요시)
ALTER TABLE products DROP COLUMN IF EXISTS tour_departure_time;

-- 새 컬럼 추가 (이미 있을 수 있음)
ALTER TABLE products ADD COLUMN IF NOT EXISTS tour_departure_times JSONB DEFAULT '[]'::jsonb;

-- 모든 NULL 값을 빈 배열로 설정
UPDATE products SET tour_departure_times = '[]'::jsonb WHERE tour_departure_times IS NULL;

-- 간단한 제약조건만 추가 (임시)
ALTER TABLE products 
ADD CONSTRAINT check_tour_departure_times_simple 
CHECK (
    tour_departure_times IS NULL 
    OR jsonb_typeof(tour_departure_times) = 'array'
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_products_tour_departure_times 
ON products USING GIN (tour_departure_times);

SELECT '기본 설정 완료! 이제 tour_departure_times 필드를 사용할 수 있습니다.' as result;

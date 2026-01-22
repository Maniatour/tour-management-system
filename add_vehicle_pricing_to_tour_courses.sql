-- 투어 코스에 차량별 가격 필드 추가
-- 가격 설정 방식: 인원별(per_person) 또는 차량별(per_vehicle)

-- 1. 가격 타입 필드 추가
ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'per_person' CHECK (price_type IN ('per_person', 'per_vehicle'));

-- 2. 차량별 가격 필드 추가
ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS price_minivan DECIMAL(10, 2) DEFAULT NULL;

ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS price_9seater DECIMAL(10, 2) DEFAULT NULL;

ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS price_13seater DECIMAL(10, 2) DEFAULT NULL;

-- 3. 기존 데이터는 모두 인원별로 설정
UPDATE tour_courses 
SET price_type = 'per_person' 
WHERE price_type IS NULL;

-- 4. 코멘트 추가
COMMENT ON COLUMN tour_courses.price_type IS '가격 설정 방식: per_person(인원별), per_vehicle(차량별)';
COMMENT ON COLUMN tour_courses.price_minivan IS '미니밴 입장료 (차량별 가격 설정 시)';
COMMENT ON COLUMN tour_courses.price_9seater IS '9인승 차량 입장료 (차량별 가격 설정 시)';
COMMENT ON COLUMN tour_courses.price_13seater IS '13인승 차량 입장료 (차량별 가격 설정 시)';

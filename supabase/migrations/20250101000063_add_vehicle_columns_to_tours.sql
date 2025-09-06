-- tours 테이블에 차량 관련 컬럼 추가
ALTER TABLE tours ADD COLUMN IF NOT EXISTS tour_car_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS car_driver_name TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS car_start_time TIME;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS car_end_time TIME;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS car_notes TEXT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tours_tour_car_id ON tours(tour_car_id);

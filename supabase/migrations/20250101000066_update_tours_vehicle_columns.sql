-- tours 테이블에 차량 타입 구분 컬럼 추가
ALTER TABLE tours ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'company' CHECK (vehicle_type IN ('company', 'rental'));

-- 렌터카 예약 ID 컬럼 추가 (렌터카 사용시)
ALTER TABLE tours ADD COLUMN IF NOT EXISTS rental_car_reservation_id TEXT REFERENCES rental_car_reservations(id) ON DELETE SET NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tours_vehicle_type ON tours(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_tours_rental_car_reservation ON tours(rental_car_reservation_id);

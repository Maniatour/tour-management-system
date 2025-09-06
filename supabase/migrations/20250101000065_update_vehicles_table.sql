-- vehicles 테이블에 차량 타입 컬럼 추가
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_category TEXT DEFAULT 'company' CHECK (vehicle_category IN ('company', 'rental'));

-- vehicles 테이블에 렌터카 관련 컬럼 추가
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_company TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_contract_number TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_start_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_end_date DATE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(vehicle_category);
CREATE INDEX IF NOT EXISTS idx_vehicles_rental_company ON vehicles(rental_company);

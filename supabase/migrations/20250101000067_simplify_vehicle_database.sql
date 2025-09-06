-- 기존 렌터카 관련 테이블들 삭제
DROP TABLE IF EXISTS rental_car_tour_assignments CASCADE;
DROP TABLE IF EXISTS rental_car_reservations CASCADE;
DROP TABLE IF EXISTS rental_cars CASCADE;

-- vehicles 테이블을 통합 차량 관리 테이블로 확장
ALTER TABLE vehicles 
  -- 차량 카테고리 (company: 회사차량, rental: 렌터카)
  ADD COLUMN IF NOT EXISTS vehicle_category TEXT DEFAULT 'company' CHECK (vehicle_category IN ('company', 'rental')),
  
  -- 렌터카 관련 정보
  ADD COLUMN IF NOT EXISTS rental_company TEXT,
  ADD COLUMN IF NOT EXISTS rental_contract_number TEXT,
  ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS weekly_rate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS monthly_rate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS insurance_coverage TEXT,
  ADD COLUMN IF NOT EXISTS mileage_limit INTEGER,
  ADD COLUMN IF NOT EXISTS excess_mileage_rate DECIMAL(10,2),
  
  -- 렌터카 예약 정보
  ADD COLUMN IF NOT EXISTS rental_start_date DATE,
  ADD COLUMN IF NOT EXISTS rental_end_date DATE,
  ADD COLUMN IF NOT EXISTS rental_pickup_location TEXT,
  ADD COLUMN IF NOT EXISTS rental_return_location TEXT,
  ADD COLUMN IF NOT EXISTS rental_contact_person TEXT,
  ADD COLUMN IF NOT EXISTS rental_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS rental_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS rental_total_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS rental_deposit_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS rental_insurance_cost DECIMAL(10,2),
  
  -- 렌터카 상태
  ADD COLUMN IF NOT EXISTS rental_status TEXT DEFAULT 'available' CHECK (rental_status IN ('available', 'reserved', 'picked_up', 'in_use', 'returned', 'cancelled')),
  
  -- 실제 픽업/반납 정보
  ADD COLUMN IF NOT EXISTS actual_pickup_date DATE,
  ADD COLUMN IF NOT EXISTS actual_pickup_time TIME,
  ADD COLUMN IF NOT EXISTS actual_return_date DATE,
  ADD COLUMN IF NOT EXISTS actual_return_time TIME,
  ADD COLUMN IF NOT EXISTS actual_mileage_start INTEGER,
  ADD COLUMN IF NOT EXISTS actual_mileage_end INTEGER,
  ADD COLUMN IF NOT EXISTS rental_notes TEXT,
  ADD COLUMN IF NOT EXISTS damage_report TEXT;

-- tours 테이블에서 불필요한 컬럼 제거
ALTER TABLE tours 
  DROP COLUMN IF EXISTS rental_car_reservation_id;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(vehicle_category);
CREATE INDEX IF NOT EXISTS idx_vehicles_rental_company ON vehicles(rental_company);
CREATE INDEX IF NOT EXISTS idx_vehicles_rental_status ON vehicles(rental_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_rental_dates ON vehicles(rental_start_date, rental_end_date);

-- 기존 vehicles 테이블의 RLS 정책은 그대로 유지

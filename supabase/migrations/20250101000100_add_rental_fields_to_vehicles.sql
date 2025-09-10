-- 렌터카 관련 필드를 vehicles 테이블에 추가
-- 2025-01-01 차량 관리 시스템 개선

-- 렌터카 관련 필드 추가
ALTER TABLE vehicles 
  ADD COLUMN IF NOT EXISTS vehicle_category TEXT DEFAULT 'company' CHECK (vehicle_category IN ('company', 'rental')),
  ADD COLUMN IF NOT EXISTS rental_company TEXT,
  ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_start_date DATE,
  ADD COLUMN IF NOT EXISTS rental_end_date DATE,
  ADD COLUMN IF NOT EXISTS rental_pickup_location TEXT,
  ADD COLUMN IF NOT EXISTS rental_return_location TEXT,
  ADD COLUMN IF NOT EXISTS rental_total_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_status TEXT DEFAULT 'available' CHECK (rental_status IN ('available', 'reserved', 'picked_up', 'in_use', 'returned', 'cancelled')),
  ADD COLUMN IF NOT EXISTS rental_notes TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(vehicle_category);
CREATE INDEX IF NOT EXISTS idx_vehicles_rental_company ON vehicles(rental_company);
CREATE INDEX IF NOT EXISTS idx_vehicles_rental_status ON vehicles(rental_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_rental_dates ON vehicles(rental_start_date, rental_end_date);

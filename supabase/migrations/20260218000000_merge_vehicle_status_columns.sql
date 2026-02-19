-- vehicle_status(회사차)와 rental_status(렌터카)를 단일 status 컬럼으로 통합
-- 2026-02-18

-- 1. 통합 status 컬럼 추가 (회사차 + 렌터카 모든 값 허용)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS status TEXT;

-- 2. 기존 데이터 이전: 회사차는 vehicle_status, 렌터카는 rental_status 사용
UPDATE vehicles
SET status = CASE
  WHEN COALESCE(vehicle_category, 'company') = 'rental'
  THEN COALESCE(rental_status, 'available')
  ELSE COALESCE(vehicle_status, '운행 가능')
END
WHERE status IS NULL;

-- 3. 기본값 및 NOT NULL 설정 (기존 행은 위 UPDATE로 채워짐)
ALTER TABLE vehicles
  ALTER COLUMN status SET DEFAULT '운행 가능';

UPDATE vehicles SET status = '운행 가능' WHERE status IS NULL;
ALTER TABLE vehicles ALTER COLUMN status SET NOT NULL;

-- 4. CHECK 제약: 회사차 값 + 렌터카 값 통합
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (status IN (
    '운행 가능', '수리 중', '대기 중', '폐차', '사용 종료',
    'available', 'reserved', 'picked_up', 'in_use', 'returned', 'cancelled'
  ));

-- 5. 기존 컬럼 및 인덱스 제거 (컬럼 삭제 시 해당 CHECK는 자동 제거됨)
DROP INDEX IF EXISTS idx_vehicles_status;
DROP INDEX IF EXISTS idx_vehicles_rental_status;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_status_check;
ALTER TABLE vehicles DROP COLUMN IF EXISTS vehicle_status;
ALTER TABLE vehicles DROP COLUMN IF EXISTS rental_status;

-- 6. status 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);

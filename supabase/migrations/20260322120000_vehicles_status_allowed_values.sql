-- vehicles.status: 허용 값을 영문 코드로 통일
-- returned, cancelled, available, inactive, reserved, maintenance 만 허용

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;

-- 기존 한글·렌터카 레거시 값 → 새 코드
-- (merge 이후 CHECK에 있던 picked_up, in_use 는 새 목록에 없음 → 점유/사용 중으로 간주해 reserved 로 통합)
UPDATE vehicles
SET status = CASE trim(status)
  WHEN '운행 가능' THEN 'available'
  WHEN '수리 중' THEN 'maintenance'
  WHEN '대기 중' THEN 'inactive'
  WHEN '폐차' THEN 'inactive'
  WHEN '사용 종료' THEN 'inactive'
  WHEN 'available' THEN 'available'
  WHEN 'reserved' THEN 'reserved'
  WHEN 'returned' THEN 'returned'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'maintenance' THEN 'maintenance'
  WHEN 'inactive' THEN 'inactive'
  WHEN 'picked_up' THEN 'reserved'
  WHEN 'in_use' THEN 'reserved'
  ELSE 'inactive'
END;

ALTER TABLE vehicles
  ALTER COLUMN status SET DEFAULT 'available';

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (
    status IN (
      'returned',
      'cancelled',
      'available',
      'inactive',
      'reserved',
      'maintenance'
    )
  );

COMMENT ON COLUMN vehicles.status IS '차량 상태: returned, cancelled, available, inactive, reserved, maintenance';

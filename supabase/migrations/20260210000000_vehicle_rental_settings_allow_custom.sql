-- 차량 렌트비 설정에 커스텀 차량 추가 지원
-- vehicle_type CHECK 제거, display_name 컬럼 추가

-- CHECK 제약 제거 (커스텀 차량 타입 허용)
ALTER TABLE vehicle_rental_settings
  DROP CONSTRAINT IF EXISTS vehicle_rental_settings_vehicle_type_check;

-- vehicle_type 길이 확장
ALTER TABLE vehicle_rental_settings
  ALTER COLUMN vehicle_type TYPE VARCHAR(50);

-- 표시 이름 컬럼 추가 (커스텀 차량용)
ALTER TABLE vehicle_rental_settings
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NULL;

COMMENT ON COLUMN vehicle_rental_settings.display_name IS '차량 표시 이름 (커스텀 차량 시 사용)';

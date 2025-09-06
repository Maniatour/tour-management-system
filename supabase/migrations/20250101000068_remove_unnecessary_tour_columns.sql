-- 투어 테이블에서 불필요한 컬럼들 삭제
ALTER TABLE tours 
  DROP COLUMN IF EXISTS car_driver_name,
  DROP COLUMN IF EXISTS car_start_time,
  DROP COLUMN IF EXISTS car_end_time,
  DROP COLUMN IF EXISTS car_notes,
  DROP COLUMN IF EXISTS vehicle_type;

-- tour_car_id로 차량을 참조하므로 vehicle_type은 차량 테이블의 vehicle_category로 확인 가능

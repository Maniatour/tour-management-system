-- 렌터카 관련 불필요한 컬럼들 삭제
ALTER TABLE vehicles 
  DROP COLUMN IF EXISTS rental_contract_number,
  DROP COLUMN IF EXISTS weekly_rate,
  DROP COLUMN IF EXISTS monthly_rate,
  DROP COLUMN IF EXISTS insurance_coverage,
  DROP COLUMN IF EXISTS mileage_limit,
  DROP COLUMN IF EXISTS excess_mileage_rate,
  DROP COLUMN IF EXISTS rental_contact_person,
  DROP COLUMN IF EXISTS rental_contact_phone,
  DROP COLUMN IF EXISTS rental_contact_email,
  DROP COLUMN IF EXISTS rental_deposit_amount,
  DROP COLUMN IF EXISTS rental_insurance_cost,
  DROP COLUMN IF EXISTS actual_pickup_date,
  DROP COLUMN IF EXISTS actual_pickup_time,
  DROP COLUMN IF EXISTS actual_return_date,
  DROP COLUMN IF EXISTS actual_return_time,
  DROP COLUMN IF EXISTS actual_mileage_start,
  DROP COLUMN IF EXISTS actual_mileage_end,
  DROP COLUMN IF EXISTS damage_report;

-- 렌터카 정보를 더 간소화
-- 필요한 필드만 유지:
-- - rental_company (렌터카 회사)
-- - daily_rate (요금)
-- - rental_start_date (렌탈 시작일)
-- - rental_end_date (렌탈 종료일)
-- - rental_pickup_location (픽업 장소)
-- - rental_return_location (반납 장소)
-- - vehicle_type (차량 모델)
-- - capacity (최대 탑승 인원)
-- - rental_total_cost (총 비용)
-- - rental_status (렌터카 상태)
-- - rental_notes (메모)

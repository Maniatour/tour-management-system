-- 차량 상태에 "사용 종료" 추가
-- 2025-01-30 차량 상태 관리 개선

-- 기존 CHECK 제약조건 제거
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_status_check;

-- 새로운 CHECK 제약조건 추가 (사용 종료 포함)
ALTER TABLE vehicles 
  ADD CONSTRAINT vehicles_vehicle_status_check 
  CHECK (vehicle_status IN ('운행 가능', '수리 중', '대기 중', '폐차', '사용 종료'));


-- 차량 닉네임(nick) 컬럼 추가 - 달력/일정 뷰에서 표시용
-- 2026-02-20

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS nick TEXT;

COMMENT ON COLUMN vehicles.nick IS '달력·일정 뷰에 표시할 차량 닉네임 (미입력 시 vehicle_number 사용)';

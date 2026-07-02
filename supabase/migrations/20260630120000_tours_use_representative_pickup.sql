-- 투어별 대표 픽업 호텔 사용 여부 (예약의 픽업 요청 호텔은 유지, 스케줄·안내는 대표 호텔 기준)
ALTER TABLE tours
ADD COLUMN IF NOT EXISTS use_representative_pickup BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tours.use_representative_pickup IS
  'true이면 픽업 호텔 그룹의 대표 호텔(정수 group_number)로 스케줄·안내. 예약 pickup_hotel(요청 호텔)은 변경하지 않음.';

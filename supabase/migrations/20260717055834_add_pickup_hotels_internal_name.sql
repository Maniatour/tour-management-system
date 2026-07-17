-- 배정 관리 예약 카드 등에 표시할 픽업 호텔 내부용 짧은 이름
ALTER TABLE public.pickup_hotels
  ADD COLUMN IF NOT EXISTS internal_name text;

COMMENT ON COLUMN public.pickup_hotels.internal_name IS '관리자 배정 화면 등 내부 표시용 짧은 호텔 이름. 고객에게는 hotel 전체 이름을 사용';

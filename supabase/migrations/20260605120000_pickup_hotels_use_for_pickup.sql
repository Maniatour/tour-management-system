-- 픽업 호텔: 마스터 활성(is_active)과 예약 픽업 선택용(use_for_pickup) 분리
ALTER TABLE public.pickup_hotels
  ADD COLUMN IF NOT EXISTS use_for_pickup boolean;

-- 기존 데이터: 이전 스케줄/폼은 is_active = true 인 호텔만 노출했으므로 동일하게 이관
UPDATE public.pickup_hotels
SET use_for_pickup = (is_active IS TRUE)
WHERE use_for_pickup IS NULL;

ALTER TABLE public.pickup_hotels
  ALTER COLUMN use_for_pickup SET DEFAULT true,
  ALTER COLUMN use_for_pickup SET NOT NULL;

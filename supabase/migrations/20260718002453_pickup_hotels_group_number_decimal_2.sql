-- pickup_hotels.group_number: 소수 1자리(DECIMAL 3,1) → 소수 2자리까지 허용
-- 예: 4.1, 4.12 / 정수(예: 4) = 그룹 대표 호텔

ALTER TABLE public.pickup_hotels
  ALTER COLUMN group_number TYPE NUMERIC(5, 2)
  USING ROUND(group_number::numeric, 2);

COMMENT ON COLUMN public.pickup_hotels.group_number IS
  '픽업 그룹 번호. 정수=대표 호텔, 소수(최대 2자리)=요청 호텔. 예: 4, 4.1, 4.12';

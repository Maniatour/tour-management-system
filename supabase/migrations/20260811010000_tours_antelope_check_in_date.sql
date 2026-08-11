-- 투어별 앤텔롭 캐년 체크인 날짜 (기본정보에서 선택)
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS antelope_check_in_date date DEFAULT NULL;

COMMENT ON COLUMN public.tours.antelope_check_in_date IS
  'Antelope Canyon check-in date for this tour. Defaults to tour_date (day 2 for overnight tours) when null.';

-- 숙박·멀티데이: 기존 행은 2일차를 기본값으로 채움
UPDATE public.tours
SET antelope_check_in_date = (tour_date::date + INTERVAL '1 day')::date
WHERE antelope_check_in_date IS NULL
  AND tour_date IS NOT NULL
  AND (
    product_id = 'MNGC1N'
    OR product_id = 'MNM1'
    OR product_id = 'MNGC2N'
    OR product_id = 'MNGC3N'
    OR product_id LIKE 'MNGC1N%'
    OR product_id LIKE 'MNM1%'
    OR product_id LIKE 'MNGC2N%'
    OR product_id LIKE 'MNGC3N%'
  );

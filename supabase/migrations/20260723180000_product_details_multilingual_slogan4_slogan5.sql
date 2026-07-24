-- 투어 하이라이트 체크리스트 추가 슬로건 (slogan3와 함께 최대 3개 표시)
ALTER TABLE public.product_details_multilingual
  ADD COLUMN IF NOT EXISTS slogan4 TEXT,
  ADD COLUMN IF NOT EXISTS slogan5 TEXT;

COMMENT ON COLUMN public.product_details_multilingual.slogan4 IS '투어 하이라이트 체크리스트 항목 2';
COMMENT ON COLUMN public.product_details_multilingual.slogan5 IS '투어 하이라이트 체크리스트 항목 3';

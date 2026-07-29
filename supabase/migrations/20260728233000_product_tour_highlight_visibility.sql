-- 상품 상단 투어 하이라이트 아이콘 줄 항목별 고객 노출 여부 (item id → false 이면 숨김)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tour_highlight_visibility JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.tour_highlight_visibility IS
  '고객 상세 페이지 상단 하이라이트 아이콘 줄 항목 표시 여부. item id → false 이면 숨김, 키 없음이면 표시';

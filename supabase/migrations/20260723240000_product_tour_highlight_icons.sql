-- 상품 상단 투어 하이라이트 아이콘 줄 (item id → lucide icon key)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tour_highlight_icons JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.tour_highlight_icons IS
  '고객 상세 페이지 상단 하이라이트 아이콘 줄 아이콘 키 (duration, groupSize, category, trustLicensedOperator, trustSmallGroup, trustFreeCancellation)';

-- 상품별 투어 하이라이트 표시 문구 (신뢰 배지 등)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tour_highlight_labels JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.tour_highlight_labels IS
  '고객 상세 페이지 상단 하이라이트 아이콘 줄 표시 문구. item id → locale → label (예: trustLicensedOperator.ko)';

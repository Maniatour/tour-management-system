-- 섹션별 고객-facing 상품 페이지 노출 여부 (키 생략 또는 true = 표시, false = 숨김)
ALTER TABLE public.product_details_multilingual
  ADD COLUMN IF NOT EXISTS customer_page_visibility JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.product_details_multilingual.customer_page_visibility IS
  '고객 상품 페이지 섹션 표시 여부. 필드명 → false 이면 숨김, 키 없음이면 표시';

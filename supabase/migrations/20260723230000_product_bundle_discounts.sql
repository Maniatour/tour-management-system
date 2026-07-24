-- 함께 구매 할인: product_recommendations (recommended_for_you 섹션)에 할인 필드 추가
ALTER TABLE public.product_recommendations
  ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (
    discount_type IS NULL OR discount_type IN ('percentage', 'fixed')
  ),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC CHECK (
    discount_value IS NULL OR discount_value >= 0
  );

COMMENT ON COLUMN public.product_recommendations.discount_type IS
  'recommended_for_you(함께 구매 할인) 섹션 전용. percentage 또는 fixed';
COMMENT ON COLUMN public.product_recommendations.discount_value IS
  '할인율(%) 또는 고정 할인액(USD). discount_type과 함께 사용';

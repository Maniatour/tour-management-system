-- 고객 상세 페이지 상품 초이스 표시 방식 (list: 리스트, card: 사진 카드뷰)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS choices_display_mode text NOT NULL DEFAULT 'list';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_choices_display_mode_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_choices_display_mode_check
      CHECK (choices_display_mode IN ('list', 'card'));
  END IF;
END $$;

COMMENT ON COLUMN public.products.choices_display_mode IS '고객 상세 페이지 상품 초이스 표시 방식: list(리스트) | card(사진 카드뷰)';

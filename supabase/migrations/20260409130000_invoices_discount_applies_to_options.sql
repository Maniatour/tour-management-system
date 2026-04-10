-- 할인이 통합 옵션 금액에도 적용되는지 여부 (false면 상품·텍스트 행만)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_applies_to_options BOOLEAN DEFAULT true;

COMMENT ON COLUMN invoices.discount_applies_to_options IS 'When false, discount base excludes rows with integrated options (itemType option).';

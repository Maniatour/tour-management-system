-- ========================================
-- 동적 가격 테이블 구조 개선 - 2단계: 컬럼 추가
-- ========================================

-- additional_options_pricing 컬럼 추가 (존재하지 않는 경우에만)
DO $$ 
BEGIN
  -- additional_options_pricing 컬럼이 없으면 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'dynamic_pricing' AND column_name = 'additional_options_pricing') THEN
    ALTER TABLE dynamic_pricing ADD COLUMN additional_options_pricing JSONB DEFAULT '{}';
  END IF;
  
  -- price_calculation_method 컬럼이 없으면 추가
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'dynamic_pricing' AND column_name = 'price_calculation_method') THEN
    ALTER TABLE dynamic_pricing ADD COLUMN price_calculation_method TEXT DEFAULT 'additive' 
    CHECK (price_calculation_method IN ('additive', 'override', 'percentage'));
  END IF;
END $$;

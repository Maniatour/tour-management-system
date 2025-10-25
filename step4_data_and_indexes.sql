-- ========================================
-- 동적 가격 테이블 구조 개선 - 4단계: 데이터 복사 및 인덱스
-- ========================================

-- 기존 options_pricing 데이터를 additional_options_pricing으로 복사 (옵션으로)
DO $$
BEGIN
  -- options_pricing 컬럼이 존재하고 additional_options_pricing이 비어있는 경우에만 데이터 복사
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'dynamic_pricing' AND column_name = 'options_pricing') THEN
    
    UPDATE dynamic_pricing 
    SET additional_options_pricing = options_pricing 
    WHERE options_pricing IS NOT NULL 
      AND (additional_options_pricing IS NULL OR additional_options_pricing = '{}');
  END IF;
END $$;

-- 새로운 인덱스 생성 (존재하지 않는 경우에만)
DO $$
BEGIN
  -- additional_options_pricing 인덱스가 없으면 생성
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_dynamic_pricing_additional_options') THEN
    CREATE INDEX idx_dynamic_pricing_additional_options ON dynamic_pricing USING GIN(additional_options_pricing);
  END IF;
END $$;

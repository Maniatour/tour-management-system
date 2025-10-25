-- ========================================
-- 동적 가격 테이블 구조 개선
-- 기존 스키마에 맞춰 상품 기본가격과 초이스 가격을 분리하여 관리
-- ========================================

-- 1. 기존 dynamic_pricing 테이블 백업
CREATE TABLE dynamic_pricing_backup AS 
SELECT * FROM dynamic_pricing;

-- 2. 기존 테이블 구조 확인 및 개선
-- adult_price, child_price, infant_price는 상품 기본가격으로 사용
-- choices_pricing은 이미 존재하므로 그대로 사용
-- options_pricing을 additional_options_pricing으로 명확히 구분

-- 3. additional_options_pricing 컬럼 추가 (존재하지 않는 경우에만)
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

-- 4. 컬럼 코멘트 추가
COMMENT ON COLUMN dynamic_pricing.adult_price IS '상품 기본 가격 (성인)';
COMMENT ON COLUMN dynamic_pricing.child_price IS '상품 기본 가격 (아동)';
COMMENT ON COLUMN dynamic_pricing.infant_price IS '상품 기본 가격 (유아)';
COMMENT ON COLUMN dynamic_pricing.choices_pricing IS '초이스별 가격 정보: {"choice_option_id": {"adult": 50, "child": 30, "infant": 20}}';
COMMENT ON COLUMN dynamic_pricing.options_pricing IS '기존 옵션별 가격 정보 (호환성 유지)';
COMMENT ON COLUMN dynamic_pricing.additional_options_pricing IS '추가 옵션별 가격 정보 (보험, 식사 등)';
COMMENT ON COLUMN dynamic_pricing.price_calculation_method IS '가격 계산 방식: additive(기본가+초이스), override(전체 덮어쓰기), percentage(비율 적용)';
COMMENT ON COLUMN dynamic_pricing.not_included_price IS '포함되지 않는 가격 (추가 비용)';
COMMENT ON COLUMN dynamic_pricing.inclusions_ko IS '포함 사항 (한국어)';
COMMENT ON COLUMN dynamic_pricing.exclusions_ko IS '불포함 사항 (한국어)';
COMMENT ON COLUMN dynamic_pricing.inclusions_en IS '포함 사항 (영어)';
COMMENT ON COLUMN dynamic_pricing.exclusions_en IS '불포함 사항 (영어)';
COMMENT ON COLUMN dynamic_pricing.markup_percent IS '마크업 비율 (%)';
COMMENT ON COLUMN dynamic_pricing.markup_amount IS '마크업 금액';
COMMENT ON COLUMN dynamic_pricing.commission_percent IS '수수료 비율 (%)';
COMMENT ON COLUMN dynamic_pricing.coupon_percent IS '쿠폰 할인 비율 (%)';
COMMENT ON COLUMN dynamic_pricing.is_sale_available IS '판매 가능 여부';

-- 5. 기존 options_pricing 데이터를 additional_options_pricing으로 복사 (옵션으로)
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

-- 6. 새로운 인덱스 생성 (존재하지 않는 경우에만)
DO $$
BEGIN
  -- additional_options_pricing 인덱스가 없으면 생성
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_dynamic_pricing_additional_options') THEN
    CREATE INDEX idx_dynamic_pricing_additional_options ON dynamic_pricing USING GIN(additional_options_pricing);
  END IF;
END $$;

-- 7. 가격 계산 함수 생성
CREATE OR REPLACE FUNCTION calculate_dynamic_price(
  p_product_id UUID,
  p_channel_id UUID,
  p_date DATE,
  p_adults INTEGER DEFAULT 1,
  p_children INTEGER DEFAULT 0,
  p_infants INTEGER DEFAULT 0,
  p_selected_choices JSONB DEFAULT '[]',
  p_selected_additional_options JSONB DEFAULT '[]'
) RETURNS TABLE(
  base_price DECIMAL(10,2),
  choices_price DECIMAL(10,2),
  additional_options_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  calculation_method TEXT
) AS $$
DECLARE
  pricing_record dynamic_pricing%ROWTYPE;
  base_total DECIMAL(10,2) := 0;
  choices_total DECIMAL(10,2) := 0;
  additional_options_total DECIMAL(10,2) := 0;
  final_total DECIMAL(10,2) := 0;
  choice_option_id TEXT;
  choice_pricing JSONB;
  additional_option_id TEXT;
  additional_option_pricing JSONB;
BEGIN
  -- 동적 가격 정보 조회
  SELECT * INTO pricing_record
  FROM dynamic_pricing
  WHERE product_id = p_product_id 
    AND channel_id = p_channel_id 
    AND date = p_date
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), 'not_found'::TEXT;
    RETURN;
  END IF;
  
  -- 기본 상품 가격 계산
  base_total := (pricing_record.adult_price * p_adults) + 
                (pricing_record.child_price * p_children) + 
                (pricing_record.infant_price * p_infants);
  
  -- 초이스 가격 계산
  IF pricing_record.choices_pricing IS NOT NULL THEN
    FOR choice_option_id IN 
      SELECT jsonb_array_elements_text(p_selected_choices)
    LOOP
      choice_pricing := pricing_record.choices_pricing->choice_option_id;
      IF choice_pricing IS NOT NULL THEN
        choices_total := choices_total + 
          COALESCE((choice_pricing->>'adult')::DECIMAL(10,2), 0) * p_adults +
          COALESCE((choice_pricing->>'child')::DECIMAL(10,2), 0) * p_children +
          COALESCE((choice_pricing->>'infant')::DECIMAL(10,2), 0) * p_infants;
      END IF;
    END LOOP;
  END IF;
  
  -- 추가 옵션 가격 계산
  IF pricing_record.additional_options_pricing IS NOT NULL THEN
    FOR additional_option_id IN 
      SELECT jsonb_array_elements_text(p_selected_additional_options)
    LOOP
      additional_option_pricing := pricing_record.additional_options_pricing->additional_option_id;
      IF additional_option_pricing IS NOT NULL THEN
        additional_options_total := additional_options_total + 
          COALESCE((additional_option_pricing->>'adult')::DECIMAL(10,2), 0) * p_adults +
          COALESCE((additional_option_pricing->>'child')::DECIMAL(10,2), 0) * p_children +
          COALESCE((additional_option_pricing->>'infant')::DECIMAL(10,2), 0) * p_infants;
      END IF;
    END LOOP;
  END IF;
  
  -- 최종 가격 계산
  CASE pricing_record.price_calculation_method
    WHEN 'additive' THEN
      final_total := base_total + choices_total + additional_options_total;
    WHEN 'override' THEN
      final_total := base_total; -- 기본가만 사용
    WHEN 'percentage' THEN
      final_total := base_total * (1 + (choices_total + additional_options_total) / 100);
    ELSE
      final_total := base_total + choices_total + additional_options_total;
  END CASE;
  
  RETURN QUERY SELECT base_total, choices_total, additional_options_total, final_total, pricing_record.price_calculation_method;
END;
$$ LANGUAGE plpgsql;

-- 8. 가격 업데이트 함수 생성
CREATE OR REPLACE FUNCTION update_choice_pricing(
  p_product_id UUID,
  p_channel_id UUID,
  p_date DATE,
  p_choice_option_id TEXT,
  p_adult_price DECIMAL(10,2),
  p_child_price DECIMAL(10,2),
  p_infant_price DECIMAL(10,2)
) RETURNS BOOLEAN AS $$
DECLARE
  existing_pricing JSONB;
  new_choice_pricing JSONB;
BEGIN
  -- 기존 가격 정보 조회
  SELECT choices_pricing INTO existing_pricing
  FROM dynamic_pricing
  WHERE product_id = p_product_id 
    AND channel_id = p_channel_id 
    AND date = p_date;
  
  IF existing_pricing IS NULL THEN
    existing_pricing := '{}';
  END IF;
  
  -- 새로운 초이스 가격 정보 생성
  new_choice_pricing := jsonb_build_object(
    'adult', p_adult_price,
    'child', p_child_price,
    'infant', p_infant_price
  );
  
  -- 기존 choices_pricing에 새로운 초이스 가격 추가/업데이트
  existing_pricing := existing_pricing || jsonb_build_object(p_choice_option_id, new_choice_pricing);
  
  -- 동적 가격 업데이트
  UPDATE dynamic_pricing
  SET choices_pricing = existing_pricing,
      updated_at = NOW()
  WHERE product_id = p_product_id 
    AND channel_id = p_channel_id 
    AND date = p_date;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 9. 뷰 생성 (기존 호환성 유지)
CREATE OR REPLACE VIEW dynamic_pricing_view AS
SELECT 
  id,
  product_id,
  channel_id,
  date,
  adult_price,
  child_price,
  infant_price,
  choices_pricing,
  additional_options_pricing,
  price_calculation_method,
  commission_percent,
  markup_amount,
  coupon_percent,
  is_sale_available,
  created_at,
  updated_at
FROM dynamic_pricing;

-- 10. 트리거 업데이트
CREATE OR REPLACE FUNCTION update_dynamic_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. 기존 트리거 재생성
DROP TRIGGER IF EXISTS trigger_update_dynamic_pricing_updated_at ON dynamic_pricing;
CREATE TRIGGER trigger_update_dynamic_pricing_updated_at
  BEFORE UPDATE ON dynamic_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_dynamic_pricing_updated_at();

-- 12. 샘플 데이터 삽입 (테스트용)
INSERT INTO dynamic_pricing (
  product_id, 
  channel_id, 
  date, 
  adult_price, 
  child_price, 
  infant_price,
  choices_pricing,
  additional_options_pricing,
  price_calculation_method
) VALUES (
  'sample-product-id',
  'sample-channel-id',
  CURRENT_DATE,
  100.00,
  80.00,
  50.00,
  '{"single_room": {"adult": 50, "child": 30, "infant": 20}, "double_room": {"adult": 30, "child": 20, "infant": 10}}',
  '{"insurance": {"adult": 10, "child": 5, "infant": 0}, "meal": {"adult": 25, "child": 15, "infant": 10}}',
  'additive'
) ON CONFLICT (product_id, channel_id, date) DO NOTHING;

-- 13. 마이그레이션 완료 확인
SELECT 
  'Migration completed successfully' AS status,
  COUNT(*) AS total_records,
  COUNT(CASE WHEN choices_pricing IS NOT NULL THEN 1 END) AS records_with_choices,
  COUNT(CASE WHEN additional_options_pricing IS NOT NULL THEN 1 END) AS records_with_additional_options
FROM dynamic_pricing;

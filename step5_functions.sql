-- ========================================
-- 동적 가격 테이블 구조 개선 - 5단계: 함수 생성
-- ========================================

-- 가격 계산 함수 생성
CREATE OR REPLACE FUNCTION calculate_dynamic_price(
  p_product_id TEXT,
  p_channel_id TEXT,
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

-- ========================================
-- 동적 가격 테이블 구조 개선 - 3단계: 코멘트 추가
-- ========================================

-- 컬럼 코멘트 추가
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

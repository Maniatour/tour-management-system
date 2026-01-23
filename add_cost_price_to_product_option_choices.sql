-- product_option_choices 테이블에 실 구매가(cost price) 필드 추가
-- 판매가와 구매가를 분리하여 운영 이익을 자동 계산할 수 있도록 함

-- 성인/아동/유아 실 구매가 필드 추가
ALTER TABLE product_option_choices
ADD COLUMN IF NOT EXISTS adult_cost_price DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS child_cost_price DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS infant_cost_price DECIMAL(10,2) DEFAULT NULL;

-- 코멘트 추가
COMMENT ON COLUMN product_option_choices.adult_cost_price IS '성인 실 구매가 (판매가와 별도로 관리)';
COMMENT ON COLUMN product_option_choices.child_cost_price IS '아동 실 구매가 (판매가와 별도로 관리)';
COMMENT ON COLUMN product_option_choices.infant_cost_price IS '유아 실 구매가 (판매가와 별도로 관리)';

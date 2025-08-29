-- 쿠폰 테이블 업데이트
-- 불필요한 컬럼 제거 및 할인 타입 개선

-- 1. 기존 테이블 백업 (선택사항)
-- CREATE TABLE coupons_backup AS SELECT * FROM coupons;

-- 2. 불필요한 컬럼들 제거
ALTER TABLE coupons DROP COLUMN IF EXISTS valid_from;
ALTER TABLE coupons DROP COLUMN IF EXISTS valid_until;
ALTER TABLE coupons DROP COLUMN IF EXISTS max_uses;
ALTER TABLE coupons DROP COLUMN IF EXISTS current_uses;

-- 3. 할인 타입 컬럼 수정 (고정값과 퍼센트 모두 지원)
ALTER TABLE coupons DROP COLUMN IF EXISTS discount_type;
ALTER TABLE coupons DROP COLUMN IF EXISTS discount_value;

-- 4. 새로운 할인 컬럼들 추가
ALTER TABLE coupons ADD COLUMN fixed_discount_amount DECIMAL(10,2) DEFAULT 0; -- 고정 할인 금액 ($)
ALTER TABLE coupons ADD COLUMN percentage_discount DECIMAL(5,2) DEFAULT 0; -- 퍼센트 할인 (%)

-- 5. 할인 적용 우선순위 컬럼 추가 (고정값 우선 또는 퍼센트 우선)
ALTER TABLE coupons ADD COLUMN discount_priority VARCHAR(20) DEFAULT 'fixed_first'; -- 'fixed_first' 또는 'percentage_first'

-- 6. 기존 데이터 마이그레이션 (필요시)
-- UPDATE coupons SET 
--   fixed_discount_amount = CASE WHEN discount_type = 'fixed' THEN discount_value ELSE 0 END,
--   percentage_discount = CASE WHEN discount_type = 'percentage' THEN discount_value ELSE 0 END;

-- 7. 테이블 구조 확인
COMMENT ON TABLE coupons IS '쿠폰 테이블 - 고정값과 퍼센트 할인을 모두 지원';
COMMENT ON COLUMN coupons.fixed_discount_amount IS '고정 할인 금액 (달러)';
COMMENT ON COLUMN coupons.percentage_discount IS '퍼센트 할인 비율';
COMMENT ON COLUMN coupons.discount_priority IS '할인 적용 우선순위 (fixed_first: 고정값 우선, percentage_first: 퍼센트 우선)';

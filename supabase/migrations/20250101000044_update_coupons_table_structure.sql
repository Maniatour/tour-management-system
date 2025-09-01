-- 쿠폰 테이블 구조 업데이트
-- 요구사항에 맞게 모든 컬럼을 nullable로 만들고 새로운 구조 적용

-- 1. 기존 테이블이 있다면 백업
-- CREATE TABLE coupons_backup AS SELECT * FROM coupons;

-- 2. 기존 테이블 삭제 (데이터가 있다면 주의)
DROP TABLE IF EXISTS coupons CASCADE;

-- 3. 새로운 쿠폰 테이블 생성 (모든 컬럼 nullable)
CREATE TABLE coupons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  coupon_code VARCHAR(100) UNIQUE, -- 쿠폰 코드
  discount_type VARCHAR(20), -- 'fixed' 또는 'percentage'
  percentage_value DECIMAL(5,2), -- 퍼센트 값
  fixed_value DECIMAL(10,2), -- 고정값 ($)
  status VARCHAR(50) DEFAULT 'active', -- 상태
  description TEXT, -- 설명
  start_date DATE, -- 시작일
  end_date DATE, -- 종료일
  channel_id TEXT REFERENCES channels(id), -- 채널 ID
  product_id TEXT REFERENCES products(id), -- 상품 ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX idx_coupons_code ON coupons(coupon_code);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_channel ON coupons(channel_id);
CREATE INDEX idx_coupons_product ON coupons(product_id);
CREATE INDEX idx_coupons_dates ON coupons(start_date, end_date);

-- 5. RLS 활성화
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책 생성
CREATE POLICY "Allow public access" ON coupons FOR ALL USING (true);

-- 7. 감사 트리거 적용
CREATE TRIGGER audit_coupons_trigger 
AFTER INSERT OR UPDATE OR DELETE ON coupons
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 8. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coupons_updated_at_trigger
  BEFORE UPDATE ON coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_coupons_updated_at();

-- 9. 테이블 및 컬럼 코멘트 추가
COMMENT ON TABLE coupons IS '쿠폰 관리 테이블 - 고정값과 퍼센트 할인을 지원하며 채널/상품별 적용 가능';
COMMENT ON COLUMN coupons.id IS '쿠폰 고유 식별자 (text 타입)';
COMMENT ON COLUMN coupons.coupon_code IS '쿠폰 코드 (고유값)';
COMMENT ON COLUMN coupons.discount_type IS '할인 타입 (fixed: 고정값, percentage: 퍼센트)';
COMMENT ON COLUMN coupons.percentage_value IS '퍼센트 할인 값 (%)';
COMMENT ON COLUMN coupons.fixed_value IS '고정 할인 금액 ($)';
COMMENT ON COLUMN coupons.status IS '쿠폰 상태 (active, inactive, expired 등)';
COMMENT ON COLUMN coupons.description IS '쿠폰 설명';
COMMENT ON COLUMN coupons.start_date IS '쿠폰 사용 시작일';
COMMENT ON COLUMN coupons.end_date IS '쿠폰 사용 종료일';
COMMENT ON COLUMN coupons.channel_id IS '적용 채널 ID (null이면 모든 채널)';
COMMENT ON COLUMN coupons.product_id IS '적용 상품 ID (null이면 모든 상품)';

-- 10. 샘플 데이터 삽입 (테스트용)
INSERT INTO coupons (
  coupon_code, 
  discount_type, 
  percentage_value, 
  fixed_value, 
  status, 
  description, 
  start_date, 
  end_date, 
  channel_id, 
  product_id
) VALUES 
('WELCOME10', 'percentage', 10.00, NULL, 'active', '신규 고객 10% 할인', '2024-01-01', '2024-12-31', NULL, NULL),
('SAVE20', 'fixed', NULL, 20.00, 'active', '20달러 할인', '2024-01-01', '2024-12-31', NULL, NULL),
('CHANNEL15', 'percentage', 15.00, NULL, 'active', '네이버 여행 채널 전용 15% 할인', '2024-01-01', '2024-12-31', (SELECT id FROM channels WHERE name = '네이버 여행' LIMIT 1), NULL),
('PRODUCT5', 'fixed', NULL, 5.00, 'active', '특정 상품 5달러 할인', '2024-01-01', '2024-12-31', NULL, (SELECT id FROM products LIMIT 1));

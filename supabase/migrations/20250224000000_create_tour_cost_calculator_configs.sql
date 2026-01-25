-- 투어 비용 계산기 설정 저장 테이블 생성
-- Migration: 20250224000000_create_tour_cost_calculator_configs
-- 이 마이그레이션은 tour_cost_calculator_configs 테이블이 존재하지 않는 경우에만 실행됩니다.

-- 테이블이 이미 존재하는지 확인하고 생성
CREATE TABLE IF NOT EXISTS tour_cost_calculator_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  
  -- 기본 설정
  tour_type VARCHAR(20) NOT NULL DEFAULT 'product', -- 'product' or 'custom'
  selected_product_id TEXT,
  
  -- 선택된 코스 및 순서
  selected_courses JSONB DEFAULT '[]', -- 선택된 코스 ID 배열
  course_order JSONB DEFAULT '[]', -- 코스 순서 및 일정 정보
  
  -- 참가자 및 차량 정보
  participant_count INTEGER DEFAULT 1,
  vehicle_type VARCHAR(20) DEFAULT 'minivan', -- 'minivan', '9seater', '13seater'
  
  -- 가격 설정
  gas_price DECIMAL(10,2) DEFAULT 4.00,
  mileage DECIMAL(10,2),
  travel_time DECIMAL(10,2), -- 시간 단위
  guide_hourly_rate DECIMAL(10,2) DEFAULT 0,
  guide_fee DECIMAL(10,2),
  
  -- 마진 설정
  margin_type VARCHAR(50) DEFAULT 'default', -- 'default', 'low_season', 'high_season', 'failed_recruitment'
  custom_margin_rate DECIMAL(5,2) DEFAULT 30,
  
  -- 기타 금액
  other_expenses JSONB DEFAULT '[]', -- [{id, name, amount}]
  
  -- 메타데이터
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (이미 존재하는 경우 무시)
CREATE INDEX IF NOT EXISTS idx_tour_cost_calculator_configs_customer_id ON tour_cost_calculator_configs(customer_id);
CREATE INDEX IF NOT EXISTS idx_tour_cost_calculator_configs_created_by ON tour_cost_calculator_configs(created_by);
CREATE INDEX IF NOT EXISTS idx_tour_cost_calculator_configs_created_at ON tour_cost_calculator_configs(created_at DESC);

-- RLS 정책 설정
ALTER TABLE tour_cost_calculator_configs ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Authenticated users can read tour cost calculator configs" ON tour_cost_calculator_configs;
DROP POLICY IF EXISTS "Authenticated users can create tour cost calculator configs" ON tour_cost_calculator_configs;
DROP POLICY IF EXISTS "Users can update their own tour cost calculator configs" ON tour_cost_calculator_configs;
DROP POLICY IF EXISTS "Users can delete their own tour cost calculator configs" ON tour_cost_calculator_configs;

-- 모든 인증된 사용자가 설정을 읽을 수 있음
CREATE POLICY "Authenticated users can read tour cost calculator configs"
  ON tour_cost_calculator_configs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 모든 인증된 사용자가 설정을 생성할 수 있음
CREATE POLICY "Authenticated users can create tour cost calculator configs"
  ON tour_cost_calculator_configs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 사용자는 자신이 생성한 설정을 수정할 수 있음
CREATE POLICY "Users can update their own tour cost calculator configs"
  ON tour_cost_calculator_configs
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 사용자는 자신이 생성한 설정을 삭제할 수 있음
CREATE POLICY "Users can delete their own tour cost calculator configs"
  ON tour_cost_calculator_configs
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_tour_cost_calculator_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 존재하는 경우 삭제 후 재생성)
DROP TRIGGER IF EXISTS tour_cost_calculator_configs_updated_at ON tour_cost_calculator_configs;
CREATE TRIGGER tour_cost_calculator_configs_updated_at
  BEFORE UPDATE ON tour_cost_calculator_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_cost_calculator_configs_updated_at();

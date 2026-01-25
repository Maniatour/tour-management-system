-- estimates 테이블에 config_id 컬럼 추가
-- Migration: 20250224000001_add_config_id_to_estimates

-- config_id 컬럼 추가 (nullable, 기존 데이터와의 호환성을 위해)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES tour_cost_calculator_configs(id) ON DELETE SET NULL;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_estimates_config_id ON estimates(config_id);

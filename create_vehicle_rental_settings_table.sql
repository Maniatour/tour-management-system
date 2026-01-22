-- 차량별 렌트비 및 MPG 설정 테이블 생성
-- 미니밴, 9인승, 13인승 차량의 일일 평균 렌트비와 MPG를 저장

CREATE TABLE IF NOT EXISTS vehicle_rental_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('minivan', '9seater', '13seater')),
  daily_rental_rate DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 일일 평균 렌트비
  mpg DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Miles Per Gallon (연비)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 차량 타입별로 하나의 설정만 유지
  UNIQUE(vehicle_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_rental_settings_vehicle_type ON vehicle_rental_settings(vehicle_type);

-- 업데이트 시간 자동 갱신을 위한 트리거
CREATE OR REPLACE FUNCTION update_vehicle_rental_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_rental_settings_updated_at
  BEFORE UPDATE ON vehicle_rental_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_rental_settings_updated_at();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE vehicle_rental_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "vehicle_rental_settings_select_policy" ON vehicle_rental_settings
  FOR SELECT USING (true);

-- 인증된 사용자만 삽입 가능
CREATE POLICY "vehicle_rental_settings_insert_policy" ON vehicle_rental_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자만 업데이트 가능
CREATE POLICY "vehicle_rental_settings_update_policy" ON vehicle_rental_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자만 삭제 가능
CREATE POLICY "vehicle_rental_settings_delete_policy" ON vehicle_rental_settings
  FOR DELETE USING (auth.role() = 'authenticated');

-- 코멘트 추가
COMMENT ON TABLE vehicle_rental_settings IS '차량별 렌트비 및 연비 설정 테이블';
COMMENT ON COLUMN vehicle_rental_settings.vehicle_type IS '차량 타입: minivan(미니밴), 9seater(9인승), 13seater(13인승)';
COMMENT ON COLUMN vehicle_rental_settings.daily_rental_rate IS '일일 평균 렌트비 (USD)';
COMMENT ON COLUMN vehicle_rental_settings.mpg IS '연비 (Miles Per Gallon)';

-- 기본 데이터 삽입 (선택사항)
INSERT INTO vehicle_rental_settings (vehicle_type, daily_rental_rate, mpg)
VALUES 
  ('minivan', 0, 0),
  ('9seater', 0, 0),
  ('13seater', 0, 0)
ON CONFLICT (vehicle_type) DO NOTHING;

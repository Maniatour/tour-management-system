-- 공유 설정 테이블 생성
-- 관리자가 설정한 공유 설정을 저장하여 모든 사용자가 같은 설정을 볼 수 있게 함

CREATE TABLE IF NOT EXISTS shared_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_shared_settings_key ON shared_settings(setting_key);

-- RLS 정책 설정
ALTER TABLE shared_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 공유 설정을 읽을 수 있음
CREATE POLICY "Anyone can read shared settings"
  ON shared_settings
  FOR SELECT
  USING (true);

-- 관리자만 공유 설정을 수정할 수 있음 (super 또는 admin)
CREATE POLICY "Only admins can modify shared settings"
  ON shared_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE team.email = auth.jwt() ->> 'email'
      AND (team.position = 'super' OR team.position = 'admin')
      AND team.is_active = true
    )
    OR
    auth.jwt() ->> 'email' IN ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_shared_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shared_settings_updated_at
  BEFORE UPDATE ON shared_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_shared_settings_updated_at();


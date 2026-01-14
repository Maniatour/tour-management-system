-- 리포트 이메일 스케줄 테이블 생성
-- Migration: 20250203000004_create_report_email_schedules_table

CREATE TABLE IF NOT EXISTS report_email_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  period VARCHAR(20) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
  send_time TIME NOT NULL DEFAULT '09:00:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_report_email_schedules_enabled ON report_email_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_report_email_schedules_period ON report_email_schedules(period);

-- RLS 활성화
ALTER TABLE report_email_schedules ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 관리자만 접근 가능
CREATE POLICY "Admins can view report email schedules" ON report_email_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
      AND team.position = 'super'
    )
  );

CREATE POLICY "Admins can insert report email schedules" ON report_email_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
      AND team.position = 'super'
    )
  );

CREATE POLICY "Admins can update report email schedules" ON report_email_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
      AND team.position = 'super'
    )
  );

CREATE POLICY "Admins can delete report email schedules" ON report_email_schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
      AND team.position = 'super'
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_report_email_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_email_schedules_updated_at
  BEFORE UPDATE ON report_email_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_report_email_schedules_updated_at();

-- 기본 스케줄 생성 (비활성화 상태)
INSERT INTO report_email_schedules (enabled, period, send_time, created_by)
VALUES 
  (false, 'daily', '09:00:00', 'system'),
  (false, 'weekly', '09:00:00', 'system'),
  (false, 'monthly', '09:00:00', 'system'),
  (false, 'yearly', '09:00:00', 'system')
ON CONFLICT DO NOTHING;

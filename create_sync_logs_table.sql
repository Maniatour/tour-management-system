-- 동기화 로그 테이블 생성
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL,
  reservations_sheet TEXT,
  tours_sheet TEXT,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental')),
  last_sync_time TIMESTAMPTZ NOT NULL,
  reservations_count INTEGER DEFAULT 0,
  tours_count INTEGER DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sync_logs_spreadsheet_id ON sync_logs(spreadsheet_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON sync_logs(sync_type);

-- RLS 정책 설정
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "sync_logs_read_policy" ON sync_logs
  FOR SELECT USING (true);

-- 관리자만 쓰기 가능
CREATE POLICY "sync_logs_write_policy" ON sync_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position = 'Super' 
      AND team.is_active = true
    )
  );

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_sync_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_logs_updated_at_trigger
  BEFORE UPDATE ON sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_logs_updated_at();

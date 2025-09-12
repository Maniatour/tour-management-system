-- 동기화 히스토리 테이블 생성
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  last_sync_time TIMESTAMP WITH TIME ZONE NOT NULL,
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_sync_history_table_spreadsheet 
ON sync_history(table_name, spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_sync_history_last_sync_time 
ON sync_history(last_sync_time DESC);

-- RLS 정책 설정
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can view sync history" ON sync_history
  FOR SELECT USING (true);

-- 인증된 사용자만 삽입 가능
CREATE POLICY "Authenticated users can insert sync history" ON sync_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자만 업데이트 가능
CREATE POLICY "Authenticated users can update sync history" ON sync_history
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_sync_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sync_history_updated_at
  BEFORE UPDATE ON sync_history
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_history_updated_at();

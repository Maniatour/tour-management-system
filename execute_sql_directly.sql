-- 1. sync_history 테이블 생성
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  last_sync_time TIMESTAMP WITH TIME ZONE NOT NULL,
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. sync_history 테이블 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sync_history_table_spreadsheet 
ON sync_history(table_name, spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_sync_history_last_sync_time 
ON sync_history(last_sync_time DESC);

-- 3. sync_history 테이블 RLS 정책 설정
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

-- 4. get_all_tables 함수 생성
CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE 'supabase_%'
  ORDER BY t.table_name;
END;
$$;

-- 5. get_all_tables 함수에 anon 권한 부여
GRANT EXECUTE ON FUNCTION get_all_tables() TO anon;

-- 6. get_table_columns 함수에 anon 권한 부여 (이미 존재한다면)
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon;

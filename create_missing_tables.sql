-- sync_history 테이블 생성
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  last_sync_time TIMESTAMP WITH TIME ZONE NOT NULL,
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sync_history_table_spreadsheet ON sync_history(table_name, spreadsheet_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_last_sync_time ON sync_history(last_sync_time DESC);

-- RLS 활성화
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- 정책 생성
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_history' AND policyname = 'Anyone can view sync history') THEN
        CREATE POLICY "Anyone can view sync history" ON sync_history FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_history' AND policyname = 'Authenticated users can insert sync history') THEN
        CREATE POLICY "Authenticated users can insert sync history" ON sync_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_history' AND policyname = 'Authenticated users can update sync history') THEN
        CREATE POLICY "Authenticated users can update sync history" ON sync_history FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- get_all_tables 함수 생성
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

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_all_tables() TO anon;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon;

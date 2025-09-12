-- 기존 함수가 있다면 삭제
DROP FUNCTION IF EXISTS get_all_tables();

-- 모든 테이블 목록을 반환하는 RPC 함수 생성
CREATE FUNCTION get_all_tables()
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

-- anon 역할에 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_all_tables() TO anon;

-- 모든 테이블 조회 함수 생성
-- Migration: 20250101000122_create_get_all_tables_function

CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE (
  table_name text,
  table_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.table_name::text,
    t.table_type::text
  FROM
    information_schema.tables t
  WHERE
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE 'sql_%'
  ORDER BY
    t.table_name;
END;
$$;

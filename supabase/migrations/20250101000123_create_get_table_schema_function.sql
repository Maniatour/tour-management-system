-- 테이블 스키마 조회 함수 생성
-- Migration: 20250101000123_create_get_table_schema_function

CREATE OR REPLACE FUNCTION get_table_schema(table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    COALESCE(c.column_default::text, '') as column_default
  FROM
    information_schema.columns c
  WHERE
    c.table_schema = 'public'
    AND c.table_name = get_table_schema.table_name
  ORDER BY
    c.ordinal_position;
END;
$$;

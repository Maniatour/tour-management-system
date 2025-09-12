-- 테이블 컬럼 정보를 가져오는 함수 생성
CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS TABLE (
  name text,
  type text,
  nullable boolean,
  "default" text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.attname::text AS name,
    pg_catalog.format_type(a.atttypid, a.atttypmod)::text AS type,
    NOT a.attnotnull AS nullable,
    COALESCE(pg_get_expr(ad.adbin, ad.adrelid)::text, '') AS "default"
  FROM
    pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_catalog.pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
  WHERE
    n.nspname = 'public'
    AND c.relname = table_name
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY
    a.attnum;
END;
$$;

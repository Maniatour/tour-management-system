-- RPC 함수에 대한 권한 부여
-- Migration: 20250101000124_grant_rpc_permissions

-- get_table_columns 함수에 대한 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;

-- get_table_schema 함수에 대한 실행 권한 부여 (있다면)
GRANT EXECUTE ON FUNCTION get_table_schema(text) TO anon;
GRANT EXECUTE ON FUNCTION get_table_schema(text) TO authenticated;

-- get_all_tables 함수에 대한 실행 권한 부여 (있다면)
GRANT EXECUTE ON FUNCTION get_all_tables() TO anon;
GRANT EXECUTE ON FUNCTION get_all_tables() TO authenticated;

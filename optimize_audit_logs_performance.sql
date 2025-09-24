-- audit_logs 테이블 성능 최적화를 위한 인덱스 생성

-- 1. table_name과 created_at 복합 인덱스 (가장 자주 사용되는 쿼리 패턴)
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created 
ON audit_logs (table_name, created_at DESC);

-- 2. record_id 인덱스 (특정 레코드의 변경 내역 조회용)
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id 
ON audit_logs (record_id);

-- 3. table_name과 record_id 복합 인덱스 (특정 테이블의 특정 레코드 조회용)
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record 
ON audit_logs (table_name, record_id, created_at DESC);

-- 4. created_at 인덱스 (시간순 정렬용)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON audit_logs (created_at DESC);

-- 5. user_email 인덱스 (사용자별 변경 내역 조회용)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email 
ON audit_logs (user_email);

-- 기존 인덱스가 있다면 삭제 (중복 방지)
-- DROP INDEX IF EXISTS idx_audit_logs_table_name;
-- DROP INDEX IF EXISTS idx_audit_logs_record_id_old;

-- 통계 정보 업데이트 (쿼리 플래너가 최적의 실행 계획을 선택하도록)
ANALYZE audit_logs;

-- 인덱스 사용 통계 확인 (선택사항)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'audit_logs' 
-- ORDER BY idx_scan DESC;

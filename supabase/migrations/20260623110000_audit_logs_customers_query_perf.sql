-- Supabase Query Performance CSV 기준 상위 패턴 보강
--
-- 1) audit_logs: reservations UPDATE + changed_fields @> (text[]) — GIN으로 포함 조건 가속
-- 2) customers: ORDER BY name 전체 스캔 완화 (이름 정렬 UI)

BEGIN;

CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_fields_gin
  ON public.audit_logs USING gin (changed_fields);

CREATE INDEX IF NOT EXISTS idx_customers_name_btree
  ON public.customers (name);

COMMIT;

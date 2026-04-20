-- 지출 테이블별 payment_method 값 분포 집계 (관리자 정규화 도구용, service_role 전용 RPC)
begin;

CREATE OR REPLACE FUNCTION public.expense_payment_method_stats()
RETURNS TABLE (
  source_table text,
  payment_method text,
  row_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'reservation_expenses'::text,
         trim(both from re.payment_method),
         COUNT(*)::bigint
  FROM reservation_expenses re
  WHERE re.payment_method IS NOT NULL AND length(trim(re.payment_method)) > 0
  GROUP BY trim(both from re.payment_method)
  UNION ALL
  SELECT 'company_expenses'::text,
         trim(both from ce.payment_method),
         COUNT(*)::bigint
  FROM company_expenses ce
  WHERE ce.payment_method IS NOT NULL AND length(trim(ce.payment_method)) > 0
  GROUP BY trim(both from ce.payment_method)
  UNION ALL
  SELECT 'tour_expenses'::text,
         trim(both from te.payment_method),
         COUNT(*)::bigint
  FROM tour_expenses te
  WHERE te.payment_method IS NOT NULL AND length(trim(te.payment_method)) > 0
  GROUP BY trim(both from te.payment_method);
$$;

COMMENT ON FUNCTION public.expense_payment_method_stats() IS
  '예약/회사/투어 지출의 payment_method 고유값별 건수. 관리자 API(service_role)에서만 호출.';

REVOKE ALL ON FUNCTION public.expense_payment_method_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expense_payment_method_stats() TO service_role;

commit;

-- 명세 대조(reconciliation_matches)에 연결되지 않은 지출만 조회하기 위한 뷰
-- RLS는 기본 테이블을 따르도록 security_invoker (PG15+)

CREATE OR REPLACE VIEW public.company_expenses_no_statement_match
WITH (security_invoker = true) AS
SELECT ce.*
FROM public.company_expenses ce
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reconciliation_matches rm
  WHERE rm.source_table = 'company_expenses'
    AND rm.source_id = ce.id
);

COMMENT ON VIEW public.company_expenses_no_statement_match IS
  'reconciliation_matches에 없는 회사 지출(명세 미대조). 지출 관리 필터용.';

CREATE OR REPLACE VIEW public.reservation_expenses_no_statement_match
WITH (security_invoker = true) AS
SELECT re.*
FROM public.reservation_expenses re
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reconciliation_matches rm
  WHERE rm.source_table = 'reservation_expenses'
    AND rm.source_id = re.id
);

COMMENT ON VIEW public.reservation_expenses_no_statement_match IS
  'reconciliation_matches에 없는 예약 지출(명세 미대조). 지출 관리 필터용.';

CREATE OR REPLACE VIEW public.tour_expenses_no_statement_match
WITH (security_invoker = true) AS
SELECT te.*
FROM public.tour_expenses te
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reconciliation_matches rm
  WHERE rm.source_table = 'tour_expenses'
    AND rm.source_id = te.id
);

COMMENT ON VIEW public.tour_expenses_no_statement_match IS
  'reconciliation_matches에 없는 투어 지출(명세 미대조). 지출 관리 필터용.';

GRANT SELECT ON public.company_expenses_no_statement_match TO authenticated;
GRANT SELECT ON public.company_expenses_no_statement_match TO service_role;
GRANT SELECT ON public.reservation_expenses_no_statement_match TO authenticated;
GRANT SELECT ON public.reservation_expenses_no_statement_match TO service_role;
GRANT SELECT ON public.tour_expenses_no_statement_match TO authenticated;
GRANT SELECT ON public.tour_expenses_no_statement_match TO service_role;

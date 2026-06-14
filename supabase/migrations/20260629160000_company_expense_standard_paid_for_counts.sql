-- 회사 지출 필터: 표준 결제내용(standard_paid_for) 값별 건수
CREATE OR REPLACE FUNCTION public.company_expense_standard_paid_for_counts()
RETURNS TABLE (standard_paid_for text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT btrim(standard_paid_for) AS standard_paid_for, COUNT(*)::bigint AS cnt
  FROM company_expenses
  WHERE deleted_at IS NULL
    AND standard_paid_for IS NOT NULL
    AND btrim(standard_paid_for) <> ''
  GROUP BY btrim(standard_paid_for);
$$;

COMMENT ON FUNCTION public.company_expense_standard_paid_for_counts() IS
  '회사 지출 표준 결제내용 필터용 — standard_paid_for 값별 건수 (RLS, 활성 행만)';

GRANT EXECUTE ON FUNCTION public.company_expense_standard_paid_for_counts() TO anon;
GRANT EXECUTE ON FUNCTION public.company_expense_standard_paid_for_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_expense_standard_paid_for_counts() TO service_role;

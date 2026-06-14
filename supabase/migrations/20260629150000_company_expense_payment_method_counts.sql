-- 회사 지출 필터: 결제 방법별 건수 (raw payment_method 그룹 — API에서 id로 통합)
CREATE OR REPLACE FUNCTION public.company_expense_payment_method_counts()
RETURNS TABLE (payment_method text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT btrim(payment_method) AS payment_method, COUNT(*)::bigint AS cnt
  FROM company_expenses
  WHERE deleted_at IS NULL
    AND payment_method IS NOT NULL
    AND btrim(payment_method) <> ''
  GROUP BY btrim(payment_method);
$$;

COMMENT ON FUNCTION public.company_expense_payment_method_counts() IS
  '회사 지출 결제 방법 필터용 — 저장된 payment_method 값별 건수 (RLS, 활성 행만)';

GRANT EXECUTE ON FUNCTION public.company_expense_payment_method_counts() TO anon;
GRANT EXECUTE ON FUNCTION public.company_expense_payment_method_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_expense_payment_method_counts() TO service_role;

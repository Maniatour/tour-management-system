-- 회사 지출 폼: 결제처(paid_to), 결제내용(paid_for) 자동완성용 고유 값 목록
CREATE OR REPLACE FUNCTION public.company_expense_suggestions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'paid_to', COALESCE(
      (SELECT jsonb_agg(q.x ORDER BY q.x)
       FROM (
         SELECT DISTINCT paid_to AS x
         FROM company_expenses
         WHERE paid_to IS NOT NULL AND btrim(paid_to) <> ''
       ) q),
      '[]'::jsonb
    ),
    'paid_for', COALESCE(
      (SELECT jsonb_agg(q.x ORDER BY q.x)
       FROM (
         SELECT DISTINCT paid_for AS x
         FROM company_expenses
         WHERE paid_for IS NOT NULL AND btrim(paid_for) <> ''
       ) q),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.company_expense_suggestions() IS '회사 지출 폼용 paid_to / paid_for 고유 값 (RLS는 호출자 기준)';

GRANT EXECUTE ON FUNCTION public.company_expense_suggestions() TO anon;
GRANT EXECUTE ON FUNCTION public.company_expense_suggestions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_expense_suggestions() TO service_role;

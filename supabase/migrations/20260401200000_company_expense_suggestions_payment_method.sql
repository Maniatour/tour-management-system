-- 회사 지출 폼: payment_method 자동완성 키 추가 (기존 RPC 교체)
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
    ),
    'payment_method', COALESCE(
      (SELECT jsonb_agg(q.x ORDER BY q.x)
       FROM (
         SELECT DISTINCT payment_method AS x
         FROM company_expenses
         WHERE payment_method IS NOT NULL AND btrim(payment_method) <> ''
       ) q),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.company_expense_suggestions() IS '회사 지출 폼용 paid_to / paid_for / payment_method 고유 값 (RLS는 호출자 기준)';

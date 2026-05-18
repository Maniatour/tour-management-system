-- 회사 지출 폼: 표준 결제내용(standard_paid_for) 미저장 건의 paid_for 자동완성 목록
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
         WHERE deleted_at IS NULL
           AND paid_to IS NOT NULL AND btrim(paid_to) <> ''
       ) q),
      '[]'::jsonb
    ),
    'paid_for', COALESCE(
      (SELECT jsonb_agg(q.x ORDER BY q.x)
       FROM (
         SELECT DISTINCT paid_for AS x
         FROM company_expenses
         WHERE deleted_at IS NULL
           AND paid_for IS NOT NULL AND btrim(paid_for) <> ''
       ) q),
      '[]'::jsonb
    ),
    'paid_for_standard_unset', COALESCE(
      (SELECT jsonb_agg(q.x ORDER BY q.x)
       FROM (
         SELECT DISTINCT paid_for AS x
         FROM company_expenses
         WHERE deleted_at IS NULL
           AND standard_paid_for IS NULL
           AND paid_for IS NOT NULL AND btrim(paid_for) <> ''
       ) q),
      '[]'::jsonb
    ),
    'payment_method', COALESCE(
      (SELECT jsonb_agg(q.x ORDER BY q.x)
       FROM (
         SELECT DISTINCT payment_method AS x
         FROM company_expenses
         WHERE deleted_at IS NULL
           AND payment_method IS NOT NULL AND btrim(payment_method) <> ''
       ) q),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.company_expense_suggestions() IS
  '회사 지출 폼용 paid_to / paid_for / paid_for_standard_unset / payment_method 고유 값 (RLS는 호출자 기준, 활성 행만)';

-- standard_paid_for: NULL·빈 문자열 모두 «미저장»으로 통일 (필터·제안 목록)
begin;

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
           AND (standard_paid_for IS NULL OR btrim(standard_paid_for) = '')
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

commit;

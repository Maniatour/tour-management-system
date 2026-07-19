-- Phase 6c.3: company_expenses SELECT RLS — operator_members path (same soft pattern as 6c.2).
-- INSERT/UPDATE/DELETE unchanged (staff session).
-- Depends: company_expenses.operator_id (6b.3), rls_is_staff_session_ok(), is_operator_member().
-- Non-goals: journal_* (no operator_id yet); booking/payment logic; staff lock-down.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_expenses'
  ) THEN
    RAISE NOTICE 'company_expenses missing — skip Phase 6c.3 RLS';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_expenses'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION
      'company_expenses.operator_id missing — apply 20260719150000_saas_operator_id_company_expenses.sql first';
  END IF;

  ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "company_expenses_select_staff" ON public.company_expenses;
  DROP POLICY IF EXISTS "company_expenses_select_staff_or_member" ON public.company_expenses;

  CREATE POLICY "company_expenses_select_staff_or_member"
    ON public.company_expenses
    FOR SELECT
    TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );
END $$;

CREATE OR REPLACE FUNCTION public.saas_company_expenses_select_rls_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_expenses'
      AND policyname = 'company_expenses_select_staff_or_member'
  );
$$;

COMMENT ON FUNCTION public.saas_company_expenses_select_rls_ready() IS
  'Phase 6c.3: true when company_expenses SELECT policy includes operator_members path.';

GRANT EXECUTE ON FUNCTION public.saas_company_expenses_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "company_expenses_select_staff_or_member"
  ON public.company_expenses IS
  'Phase 6c.3: staff session OR operator member. Writes unchanged.';

COMMIT;

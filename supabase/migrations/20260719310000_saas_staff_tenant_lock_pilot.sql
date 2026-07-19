-- Phase 6d.0: Staff tenant lock helpers + company_expenses SELECT pilot.
-- When JWT app_metadata.operator_id is ABSENT → staff SELECT unchanged (all rows).
-- When claim is PRESENT → staff SELECT limited to current_operator_id().
-- Non-staff: is_operator_member_strict (no is_staff bypass).
-- Default: no claim written until app opts in (SAAS_STAFF_TENANT_LOCK) — Kovegas safe.
-- Depends: current_operator_id(), rls_is_staff_session_ok(), is_operator_member_strict(),
--          company_expenses.operator_id (6b.3).

BEGIN;

CREATE OR REPLACE FUNCTION public.saas_jwt_active_operator_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  claim_val text;
BEGIN
  BEGIN
    claim_val := nullif(
      auth.jwt() -> 'app_metadata' ->> 'operator_id',
      ''
    );
    IF claim_val IS NOT NULL THEN
      RETURN claim_val::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.saas_jwt_active_operator_id() IS
  'Phase 6d.0: JWT app_metadata.operator_id or NULL if unset.';

CREATE OR REPLACE FUNCTION public.staff_can_select_operator_row(p_operator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.rls_is_staff_session_ok() THEN
    RETURN false;
  END IF;

  -- Legacy open: no active-operator claim on JWT → keep all-tenant staff SELECT
  IF public.saas_jwt_active_operator_id() IS NULL THEN
    RETURN true;
  END IF;

  IF p_operator_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN p_operator_id = public.current_operator_id();
END;
$$;

COMMENT ON FUNCTION public.staff_can_select_operator_row(uuid) IS
  'Phase 6d.0: staff SELECT helper. Unscoped until JWT operator_id claim exists; then scoped to current_operator_id().';

GRANT EXECUTE ON FUNCTION public.saas_jwt_active_operator_id()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_can_select_operator_row(uuid)
  TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_expenses'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'company_expenses.operator_id missing — apply Phase 6b.3 first';
  END IF;

  ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "company_expenses_select_staff_or_member"
    ON public.company_expenses;
  DROP POLICY IF EXISTS "company_expenses_select_staff_scoped_or_strict_member"
    ON public.company_expenses;

  CREATE POLICY "company_expenses_select_staff_scoped_or_strict_member"
    ON public.company_expenses
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );
END $$;

CREATE OR REPLACE FUNCTION public.saas_staff_tenant_lock_pilot_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'staff_can_select_operator_row'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'company_expenses'
        AND policyname = 'company_expenses_select_staff_scoped_or_strict_member'
    );
$$;

COMMENT ON FUNCTION public.saas_staff_tenant_lock_pilot_ready() IS
  'Phase 6d.0: true when company_expenses SELECT uses JWT-aware staff lock helper.';

GRANT EXECUTE ON FUNCTION public.saas_staff_tenant_lock_pilot_ready()
  TO authenticated, service_role;

-- Keep 6c.3 smoke green: treat new policy name as ready too
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
      AND policyname IN (
        'company_expenses_select_staff_or_member',
        'company_expenses_select_staff_scoped_or_strict_member'
      )
  );
$$;

COMMENT ON POLICY "company_expenses_select_staff_scoped_or_strict_member"
  ON public.company_expenses IS
  'Phase 6d.0 pilot: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMIT;

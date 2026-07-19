-- Phase 6c.6: Attendance SELECT tenancy helpers + soft SELECT rewrite.
-- Problem: is_operator_member() short-circuits is_staff() — OR'ing it onto
-- attendance SELECT would let every staff see all employees' rows.
-- Solution:
--   is_operator_member_strict() — membership only (no staff bypass)
--   is_operator_hr_member() — strict + role owner/admin
-- SELECT: own email OR platform admin OR (non-staff HR member of row.operator_id)
-- Writes unchanged. Kovegas staff privacy preserved (managers still need admin session).

BEGIN;

CREATE OR REPLACE FUNCTION public.is_operator_member_strict(p_operator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  email_val text;
BEGIN
  IF p_operator_id IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    email_val := lower(trim(public.current_email()));
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF email_val IS NULL OR email_val = '' THEN
    BEGIN
      email_val := public.session_email_from_auth_users();
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  END IF;

  IF email_val IS NULL OR email_val = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.operator_members om
    WHERE om.operator_id = p_operator_id
      AND lower(om.email) = email_val
      AND om.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.is_operator_member_strict(uuid) IS
  'True if current user is an active operator_members row for the operator. No is_staff() bypass.';

CREATE OR REPLACE FUNCTION public.is_operator_hr_member(p_operator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  email_val text;
BEGIN
  IF p_operator_id IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    email_val := lower(trim(public.current_email()));
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF email_val IS NULL OR email_val = '' THEN
    BEGIN
      email_val := public.session_email_from_auth_users();
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  END IF;

  IF email_val IS NULL OR email_val = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.operator_members om
    WHERE om.operator_id = p_operator_id
      AND lower(om.email) = email_val
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
  );
END;
$$;

COMMENT ON FUNCTION public.is_operator_hr_member(uuid) IS
  'True if current user is active owner/admin of the operator (strict membership).';

GRANT EXECUTE ON FUNCTION public.is_operator_member_strict(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_operator_hr_member(uuid)
  TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendance_records'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION
      'attendance_records.operator_id missing — apply Phase 6b.2 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'monthly_attendance_stats'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION
      'monthly_attendance_stats.operator_id missing — apply Phase 6b.2 first';
  END IF;

  ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.monthly_attendance_stats ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "attendance_records_select_own_or_admin"
    ON public.attendance_records;
  DROP POLICY IF EXISTS "attendance_records_select_own_admin_or_tenant_hr"
    ON public.attendance_records;

  CREATE POLICY "attendance_records_select_own_admin_or_tenant_hr"
    ON public.attendance_records
    FOR SELECT
    TO authenticated
    USING (
      public.rls_admin_session_ok()
      OR lower(trim(coalesce(employee_email, ''))) =
         lower(trim(coalesce(public.current_email(), '')))
      OR (
        length(public.session_email_from_auth_users()) > 0
        AND lower(trim(coalesce(employee_email, ''))) =
            public.session_email_from_auth_users()
      )
      OR (
        -- Commerce-only / non-staff Operator B owner·admin: tenant HR view
        NOT public.rls_is_staff_session_ok()
        AND public.is_operator_hr_member(operator_id)
      )
    );

  DROP POLICY IF EXISTS "monthly_attendance_stats_select_own_or_admin"
    ON public.monthly_attendance_stats;
  DROP POLICY IF EXISTS "monthly_attendance_stats_select_own_admin_or_tenant_hr"
    ON public.monthly_attendance_stats;

  CREATE POLICY "monthly_attendance_stats_select_own_admin_or_tenant_hr"
    ON public.monthly_attendance_stats
    FOR SELECT
    TO authenticated
    USING (
      public.rls_admin_session_ok()
      OR lower(trim(coalesce(employee_email, ''))) =
         lower(trim(coalesce(public.current_email(), '')))
      OR (
        length(public.session_email_from_auth_users()) > 0
        AND lower(trim(coalesce(employee_email, ''))) =
            public.session_email_from_auth_users()
      )
      OR (
        NOT public.rls_is_staff_session_ok()
        AND public.is_operator_hr_member(operator_id)
      )
    );
END $$;

CREATE OR REPLACE FUNCTION public.saas_attendance_select_rls_ready()
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
      WHERE n.nspname = 'public' AND p.proname = 'is_operator_member_strict'
    )
    AND EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_operator_hr_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'attendance_records'
        AND policyname = 'attendance_records_select_own_admin_or_tenant_hr'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'monthly_attendance_stats'
        AND policyname = 'monthly_attendance_stats_select_own_admin_or_tenant_hr'
    );
$$;

COMMENT ON FUNCTION public.saas_attendance_select_rls_ready() IS
  'Phase 6c.6: true when attendance SELECT uses own/admin/non-staff tenant HR path.';

GRANT EXECUTE ON FUNCTION public.saas_attendance_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "attendance_records_select_own_admin_or_tenant_hr"
  ON public.attendance_records IS
  'Phase 6c.6: own OR platform admin OR non-staff operator owner/admin. Writes unchanged.';

COMMENT ON POLICY "monthly_attendance_stats_select_own_admin_or_tenant_hr"
  ON public.monthly_attendance_stats IS
  'Phase 6c.6: own OR platform admin OR non-staff operator owner/admin. Writes unchanged.';

COMMIT;

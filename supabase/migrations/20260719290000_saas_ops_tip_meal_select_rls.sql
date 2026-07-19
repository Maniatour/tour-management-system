-- Phase 6c.7: Ops tip/meal SELECT — non-staff tenant HR path (attendance pattern).
-- Do NOT OR is_operator_member() (staff bypass would widen tip privacy).
-- Depends: operator_id (6b.4–6b.5), is_operator_hr_member() (6c.6),
--          rls_is_staff_session_ok(), session_email_from_auth_users().
-- Writes unchanged.

BEGIN;

DO $$
BEGIN
  -- ---- office_meal_log: fold tenant HR into SELECT (own/staff preserved) ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'office_meal_log'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'office_meal_log.operator_id missing — apply Phase 6b.4 first';
  END IF;

  ALTER TABLE public.office_meal_log ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "office_meal_log_select_own_or_staff"
    ON public.office_meal_log;
  DROP POLICY IF EXISTS "office_meal_log_select_own_staff_or_tenant_hr"
    ON public.office_meal_log;

  CREATE POLICY "office_meal_log_select_own_staff_or_tenant_hr"
    ON public.office_meal_log
    FOR SELECT
    TO authenticated
    USING (
      public.rls_is_staff_session_ok()
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

  -- ---- tour_office_tips: ADD tenant HR SELECT (keep staff_can_view_*) ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_office_tips'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'tour_office_tips.operator_id missing — apply Phase 6b.4 first';
  END IF;

  ALTER TABLE public.tour_office_tips ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "tour_office_tips_select_tenant_hr"
    ON public.tour_office_tips;
  CREATE POLICY "tour_office_tips_select_tenant_hr"
    ON public.tour_office_tips
    FOR SELECT
    TO authenticated
    USING (
      NOT public.rls_is_staff_session_ok()
      AND public.is_operator_hr_member(operator_id)
    );

  -- ---- tour_tip_shares: ADD tenant HR SELECT ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_tip_shares'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'tour_tip_shares.operator_id missing — apply Phase 6b.5 first';
  END IF;

  ALTER TABLE public.tour_tip_shares ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "tour_tip_shares_select_tenant_hr"
    ON public.tour_tip_shares;
  CREATE POLICY "tour_tip_shares_select_tenant_hr"
    ON public.tour_tip_shares
    FOR SELECT
    TO authenticated
    USING (
      NOT public.rls_is_staff_session_ok()
      AND public.is_operator_hr_member(operator_id)
    );

  -- ---- tour_tip_share_ops: ADD tenant HR SELECT ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_tip_share_ops'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'tour_tip_share_ops.operator_id missing — apply Phase 6b.5 first';
  END IF;

  ALTER TABLE public.tour_tip_share_ops ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "tour_tip_share_ops_select_tenant_hr"
    ON public.tour_tip_share_ops;
  CREATE POLICY "tour_tip_share_ops_select_tenant_hr"
    ON public.tour_tip_share_ops
    FOR SELECT
    TO authenticated
    USING (
      NOT public.rls_is_staff_session_ok()
      AND public.is_operator_hr_member(operator_id)
    );
END $$;

CREATE OR REPLACE FUNCTION public.saas_ops_tip_meal_select_rls_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'office_meal_log'
        AND policyname = 'office_meal_log_select_own_staff_or_tenant_hr'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tour_office_tips'
        AND policyname = 'tour_office_tips_select_tenant_hr'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tour_tip_shares'
        AND policyname = 'tour_tip_shares_select_tenant_hr'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tour_tip_share_ops'
        AND policyname = 'tour_tip_share_ops_select_tenant_hr'
    );
$$;

COMMENT ON FUNCTION public.saas_ops_tip_meal_select_rls_ready() IS
  'Phase 6c.7: true when tip/meal SELECT includes non-staff tenant HR path.';

GRANT EXECUTE ON FUNCTION public.saas_ops_tip_meal_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "office_meal_log_select_own_staff_or_tenant_hr"
  ON public.office_meal_log IS
  'Phase 6c.7: own OR staff OR non-staff tenant HR. Writes unchanged.';

COMMENT ON POLICY "tour_office_tips_select_tenant_hr"
  ON public.tour_office_tips IS
  'Phase 6c.7: non-staff operator owner/admin SELECT (OR with existing staff policies).';

COMMENT ON POLICY "tour_tip_shares_select_tenant_hr"
  ON public.tour_tip_shares IS
  'Phase 6c.7: non-staff operator owner/admin SELECT (OR with existing own/admin policies).';

COMMENT ON POLICY "tour_tip_share_ops_select_tenant_hr"
  ON public.tour_tip_share_ops IS
  'Phase 6c.7: non-staff operator owner/admin SELECT (OR with existing own/admin policies).';

COMMIT;

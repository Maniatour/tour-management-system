-- Phase 6c.5: Fleet SELECT RLS — operator_members path (same soft pattern as 6c.2).
-- Tables: vehicles, vehicle_maintenance, vehicle_maintenance_schedules
-- schedules previously had SELECT USING (true) — tightened here.
-- Writes unchanged. Attendance deferred (own_or_admin vs is_operator_member staff bypass).
-- Depends: operator_id (6b.0–6b.1), rls_is_staff_session_ok(), is_operator_member().

BEGIN;

DO $$
BEGIN
  -- ---- vehicles ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'vehicles.operator_id missing — apply Phase 6b.0 first';
  END IF;

  ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "vehicles_select_staff" ON public.vehicles;
  DROP POLICY IF EXISTS "vehicles_select_staff_or_member" ON public.vehicles;
  CREATE POLICY "vehicles_select_staff_or_member"
    ON public.vehicles FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  -- ---- vehicle_maintenance ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_maintenance'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'vehicle_maintenance.operator_id missing — apply Phase 6b.1 first';
  END IF;

  ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "vehicle_maintenance_select_staff" ON public.vehicle_maintenance;
  DROP POLICY IF EXISTS "vehicle_maintenance_select_staff_or_member" ON public.vehicle_maintenance;
  CREATE POLICY "vehicle_maintenance_select_staff_or_member"
    ON public.vehicle_maintenance FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  -- ---- vehicle_maintenance_schedules (was open SELECT for authenticated) ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_maintenance_schedules'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION
      'vehicle_maintenance_schedules.operator_id missing — apply Phase 6b.1 first';
  END IF;

  ALTER TABLE public.vehicle_maintenance_schedules ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "vehicle_maintenance_schedules_select"
    ON public.vehicle_maintenance_schedules;
  DROP POLICY IF EXISTS "vehicle_maintenance_schedules_select_staff_or_member"
    ON public.vehicle_maintenance_schedules;
  CREATE POLICY "vehicle_maintenance_schedules_select_staff_or_member"
    ON public.vehicle_maintenance_schedules FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );
END $$;

CREATE OR REPLACE FUNCTION public.saas_fleet_select_rls_ready()
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
      WHERE schemaname = 'public' AND tablename = 'vehicles'
        AND policyname = 'vehicles_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'vehicle_maintenance'
        AND policyname = 'vehicle_maintenance_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'vehicle_maintenance_schedules'
        AND policyname = 'vehicle_maintenance_schedules_select_staff_or_member'
    );
$$;

COMMENT ON FUNCTION public.saas_fleet_select_rls_ready() IS
  'Phase 6c.5: true when fleet SELECT policies include operator_members path.';

GRANT EXECUTE ON FUNCTION public.saas_fleet_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "vehicles_select_staff_or_member" ON public.vehicles IS
  'Phase 6c.5: staff session OR operator member. Writes unchanged.';

COMMENT ON POLICY "vehicle_maintenance_select_staff_or_member"
  ON public.vehicle_maintenance IS
  'Phase 6c.5: staff session OR operator member. Writes unchanged.';

COMMENT ON POLICY "vehicle_maintenance_schedules_select_staff_or_member"
  ON public.vehicle_maintenance_schedules IS
  'Phase 6c.5: staff session OR operator member (replaces open authenticated SELECT).';

COMMIT;

-- Phase 6c.8: tour_expenses + reservation_expenses SELECT — soft member path.
-- Pattern matches payment_records (6c.1): staff OR is_operator_member OR assignee.
-- Writes unchanged. Depends: operator_id (6b.6), rls_is_staff_session_ok(),
--   is_operator_member(), *_expense_row_accessible_as_assignee().

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_expenses'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'tour_expenses.operator_id missing — apply Phase 6b.6 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservation_expenses'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION
      'reservation_expenses.operator_id missing — apply Phase 6b.6 first';
  END IF;

  ALTER TABLE public.tour_expenses ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.reservation_expenses ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "tour_expenses_select_staff_or_assignee"
    ON public.tour_expenses;
  DROP POLICY IF EXISTS "tour_expenses_select_staff_member_or_assignee"
    ON public.tour_expenses;

  CREATE POLICY "tour_expenses_select_staff_member_or_assignee"
    ON public.tour_expenses
    FOR SELECT
    TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
      OR (
        tour_id IS NOT NULL
        AND public.tour_expense_row_accessible_as_assignee(tour_id)
      )
    );

  DROP POLICY IF EXISTS "reservation_expenses_select_staff_or_assignee"
    ON public.reservation_expenses;
  DROP POLICY IF EXISTS "reservation_expenses_select_staff_member_or_assignee"
    ON public.reservation_expenses;

  CREATE POLICY "reservation_expenses_select_staff_member_or_assignee"
    ON public.reservation_expenses
    FOR SELECT
    TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
      OR (
        reservation_id IS NOT NULL
        AND public.reservation_expense_row_accessible_as_assignee(reservation_id)
      )
    );
END $$;

CREATE OR REPLACE FUNCTION public.saas_ops_tour_reservation_expenses_select_rls_ready()
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
        AND tablename = 'tour_expenses'
        AND policyname = 'tour_expenses_select_staff_member_or_assignee'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'reservation_expenses'
        AND policyname = 'reservation_expenses_select_staff_member_or_assignee'
    );
$$;

COMMENT ON FUNCTION public.saas_ops_tour_reservation_expenses_select_rls_ready() IS
  'Phase 6c.8: true when tour/reservation expenses SELECT includes operator_members path.';

GRANT EXECUTE ON FUNCTION public.saas_ops_tour_reservation_expenses_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "tour_expenses_select_staff_member_or_assignee"
  ON public.tour_expenses IS
  'Phase 6c.8: staff OR operator member OR tour assignee. Writes unchanged.';

COMMENT ON POLICY "reservation_expenses_select_staff_member_or_assignee"
  ON public.reservation_expenses IS
  'Phase 6c.8: staff OR operator member OR reservation assignee. Writes unchanged.';

COMMIT;

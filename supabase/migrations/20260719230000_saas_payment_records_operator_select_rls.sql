-- Phase 6c.1: payment_records SELECT RLS — add operator_members path (Commerce v2 style).
-- INSERT/UPDATE/DELETE policies unchanged (staff / tour assignee).
-- Depends: operator_id on payment_records (6b.11), is_operator_member(),
--          reservation_expense_row_accessible_as_assignee(), is_staff(), current_email().
-- Non-goals: booking/payment/checkout logic; staff cross-tenant lock-down
--            (is_staff() still sees all rows; app operator_id filter remains 1st line for staff).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
  ) THEN
    RAISE NOTICE 'payment_records missing — skip Phase 6c.1 RLS';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION
      'payment_records.operator_id missing — apply 20260719220000_saas_operator_id_payment_records.sql first';
  END IF;

  ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "payment_records_select_staff_or_assignee"
    ON public.payment_records;
  DROP POLICY IF EXISTS "payment_records_select_staff_member_assignee_or_customer"
    ON public.payment_records;

  CREATE POLICY "payment_records_select_staff_member_assignee_or_customer"
    ON public.payment_records
    FOR SELECT
    TO authenticated
    USING (
      public.is_staff()
      OR public.is_operator_member(operator_id)
      OR (
        reservation_id IS NOT NULL
        AND public.reservation_expense_row_accessible_as_assignee(reservation_id)
      )
      OR (
        reservation_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.reservations r
          INNER JOIN public.customers c ON c.id = r.customer_id
          WHERE r.id = reservation_id
            AND lower(trim(coalesce(c.email, ''))) =
                lower(trim(coalesce(public.current_email(), '')))
        )
      )
    );
END $$;

-- Smoke helper for pilot-status (service_role / authenticated).
CREATE OR REPLACE FUNCTION public.saas_payment_records_select_rls_ready()
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
      AND tablename = 'payment_records'
      AND policyname = 'payment_records_select_staff_member_assignee_or_customer'
  );
$$;

COMMENT ON FUNCTION public.saas_payment_records_select_rls_ready() IS
  'Phase 6c.1: true when payment_records SELECT policy includes operator_members path.';

GRANT EXECUTE ON FUNCTION public.saas_payment_records_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "payment_records_select_staff_member_assignee_or_customer"
  ON public.payment_records IS
  'Phase 6c.1: staff OR operator member OR tour assignee OR reservation customer. Writes unchanged.';

COMMIT;
